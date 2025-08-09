#!/usr/bin/env python3
"""
Hardware Agent for CodeCraft IDE
Connects to remote IDE server and provides local hardware access (Serial/USB, Camera, Audio)
"""

import os
import sys
import time
import json
import platform
import threading
from datetime import datetime

try:
    import socketio
    import serial
    import serial.tools.list_ports
except ImportError as e:
    print(f"Missing required packages. Please install:")
    print("pip3 install python-socketio[client] pyserial")
    sys.exit(1)

# Optional camera support
try:
    import cv2
    import base64
    CAMERA_AVAILABLE = True
except ImportError:
    CAMERA_AVAILABLE = False
    print("Camera support disabled. Install with: pip3 install opencv-python")

class HardwareAgent:
    def __init__(self, server_url, agent_id=None, auth_token=None):
        self.server_url = server_url
        self.agent_id = agent_id or f"agent-{platform.node()}-{int(time.time())}"
        self.auth_token = auth_token or os.getenv('AGENT_AUTH_TOKEN', 'hardware-agent-secret-2024')
        
        # Socket.IO client
        self.sio = socketio.Client(logger=False, engineio_logger=False)
        
        # Hardware state
        self.serial_connection = None
        self.serial_port = None
        self.camera = None
        self.camera_active = False
        
        # Setup event handlers
        self.setup_handlers()
        
        print(f"Hardware Agent initialized: {self.agent_id}")
        print(f"Platform: {platform.system()} {platform.release()}")
        print(f"Server: {self.server_url}")
    
    def setup_handlers(self):
        @self.sio.event
        def connect():
            print("Connected to IDE server")
            self.register_agent()
        
        @self.sio.event
        def disconnect():
            print("Disconnected from IDE server")
            self.cleanup()
        
        @self.sio.event
        def registration_success(data):
            print(f"Agent registered successfully: {data.get('agentId')}")
            self.start_heartbeat()
        
        @self.sio.event
        def registration_failed(data):
            print(f"Agent registration failed: {data.get('error')}")
            self.sio.disconnect()
        
        # Serial/USB handlers
        @self.sio.event
        def list_serial_ports(data):
            self.handle_list_serial_ports(data)
        
        @self.sio.event
        def serial_open(data):
            self.handle_serial_open(data)
        
        @self.sio.event
        def serial_write(data):
            self.handle_serial_write(data)
        
        @self.sio.event
        def serial_close(data):
            self.handle_serial_close(data)
        
        # Camera handlers
        @self.sio.event
        def camera_list(data):
            self.handle_camera_list(data)
        
        @self.sio.event
        def camera_start(data):
            self.handle_camera_start(data)
        
        @self.sio.event
        def camera_capture(data):
            self.handle_camera_capture(data)
        
        @self.sio.event
        def camera_stop(data):
            self.handle_camera_stop(data)
    
    def register_agent(self):
        """Register this agent with the server"""
        registration_data = {
            'agentId': self.agent_id,
            'name': f"Hardware Agent ({platform.node()})",
            'platform': f"{platform.system()} {platform.release()}",
            'authToken': self.auth_token
        }
        self.sio.emit('register', registration_data)
    
    def start_heartbeat(self):
        """Start heartbeat thread"""
        def heartbeat_loop():
            while self.sio.connected:
                try:
                    self.sio.emit('heartbeat')
                    time.sleep(30)  # Send heartbeat every 30 seconds
                except Exception as e:
                    print(f"Heartbeat error: {e}")
                    break
        
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
    
    def handle_list_serial_ports(self, data):
        """List available serial ports"""
        try:
            ports = []
            for port in serial.tools.list_ports.comports():
                ports.append({
                    'device': port.device,
                    'name': port.name or port.device,
                    'description': port.description or 'Unknown device',
                    'manufacturer': port.manufacturer or 'Unknown',
                    'vid': port.vid,
                    'pid': port.pid
                })
            
            self.sio.emit('serial_ports_list', {
                'requestId': data.get('requestId'),
                'ports': ports
            })
            print(f"Listed {len(ports)} serial ports")
            
        except Exception as e:
            self.sio.emit('error_response', {
                'requestId': data.get('requestId'),
                'error': f"Failed to list serial ports: {str(e)}"
            })
    
    def handle_serial_open(self, data):
        """Open serial connection"""
        try:
            port = data.get('port')
            baudrate = data.get('baudrate', 9600)
            
            # Close existing connection if any
            if self.serial_connection:
                self.serial_connection.close()
            
            # Open new connection
            self.serial_connection = serial.Serial(
                port=port,
                baudrate=baudrate,
                timeout=1,
                write_timeout=1
            )
            self.serial_port = port
            
            # Start reading thread
            self.start_serial_reader(data.get('requestId'))
            
            self.sio.emit('serial_opened', {
                'requestId': data.get('requestId'),
                'success': True,
                'port': port,
                'baudrate': baudrate
            })
            print(f"Serial port opened: {port} at {baudrate} baud")
            
        except Exception as e:
            self.sio.emit('serial_opened', {
                'requestId': data.get('requestId'),
                'success': False,
                'error': f"Failed to open serial port: {str(e)}"
            })
    
    def start_serial_reader(self, request_id):
        """Start thread to read serial data"""
        def read_loop():
            while self.serial_connection and self.serial_connection.is_open:
                try:
                    if self.serial_connection.in_waiting > 0:
                        data = self.serial_connection.read(self.serial_connection.in_waiting)
                        if data:
                            self.sio.emit('serial_data', {
                                'requestId': request_id,
                                'data': data.decode('utf-8', errors='replace')
                            })
                    time.sleep(0.01)  # Small delay to prevent busy waiting
                except Exception as e:
                    print(f"Serial read error: {e}")
                    break
        
        reader_thread = threading.Thread(target=read_loop, daemon=True)
        reader_thread.start()
    
    def handle_serial_write(self, data):
        """Write data to serial port"""
        try:
            if not self.serial_connection or not self.serial_connection.is_open:
                raise Exception("Serial port not open")
            
            write_data = data.get('data', '')
            if isinstance(write_data, str):
                write_data = write_data.encode('utf-8')
            
            self.serial_connection.write(write_data)
            self.serial_connection.flush()
            
            print(f"Serial write: {len(write_data)} bytes")
            
        except Exception as e:
            self.sio.emit('error_response', {
                'requestId': data.get('requestId'),
                'error': f"Failed to write to serial port: {str(e)}"
            })
    
    def handle_serial_close(self, data):
        """Close serial connection"""
        try:
            if self.serial_connection:
                self.serial_connection.close()
                self.serial_connection = None
                self.serial_port = None
            
            self.sio.emit('serial_closed', {
                'requestId': data.get('requestId'),
                'success': True
            })
            print("Serial port closed")
            
        except Exception as e:
            self.sio.emit('serial_closed', {
                'requestId': data.get('requestId'),
                'success': False,
                'error': f"Failed to close serial port: {str(e)}"
            })
    
    def handle_camera_list(self, data):
        """List available cameras"""
        try:
            if not CAMERA_AVAILABLE:
                self.sio.emit('error_response', {
                    'requestId': data.get('requestId'),
                    'error': 'Camera support not available. Install opencv-python.'
                })
                return
            
            cameras = []
            # Test cameras 0-3 (most systems have 0-2 max)
            for i in range(4):
                cap = cv2.VideoCapture(i)
                if cap.isOpened():
                    cameras.append({
                        'id': i,
                        'name': f'Camera {i}',
                        'device': f'/dev/video{i}' if platform.system() == 'Linux' else f'Camera {i}'
                    })
                    cap.release()
            
            self.sio.emit('camera_list_response', {
                'requestId': data.get('requestId'),
                'cameras': cameras
            })
            print(f"Found {len(cameras)} camera(s)")
            
        except Exception as e:
            self.sio.emit('error_response', {
                'requestId': data.get('requestId'),
                'error': f"Failed to list cameras: {str(e)}"
            })
    
    def handle_camera_start(self, data):
        """Start camera capture"""
        try:
            if not CAMERA_AVAILABLE:
                self.sio.emit('camera_start_response', {
                    'requestId': data.get('requestId'),
                    'success': False,
                    'error': 'Camera support not available'
                })
                return
            
            camera_id = data.get('cameraId', 0)
            
            # Stop existing camera if any
            if self.camera:
                self.camera.release()
            
            # Start new camera
            self.camera = cv2.VideoCapture(camera_id)
            if not self.camera.isOpened():
                raise Exception(f"Cannot open camera {camera_id}")
            
            # Set camera properties for better performance
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            self.camera_active = True
            
            self.sio.emit('camera_start_response', {
                'requestId': data.get('requestId'),
                'success': True,
                'cameraId': camera_id
            })
            print(f"Camera {camera_id} started")
            
        except Exception as e:
            self.sio.emit('camera_start_response', {
                'requestId': data.get('requestId'),
                'success': False,
                'error': f"Failed to start camera: {str(e)}"
            })
    
    def handle_camera_capture(self, data):
        """Capture image from camera"""
        try:
            if not self.camera or not self.camera_active:
                raise Exception("Camera not started")
            
            ret, frame = self.camera.read()
            if not ret:
                raise Exception("Failed to capture frame")
            
            # Encode image as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            
            # Convert to base64
            image_base64 = base64.b64encode(buffer).decode('utf-8')
            
            self.sio.emit('camera_capture_response', {
                'requestId': data.get('requestId'),
                'success': True,
                'image': image_base64,
                'format': 'jpeg'
            })
            print("Image captured and sent")
            
        except Exception as e:
            self.sio.emit('camera_capture_response', {
                'requestId': data.get('requestId'),
                'success': False,
                'error': f"Failed to capture image: {str(e)}"
            })
    
    def handle_camera_stop(self, data):
        """Stop camera capture"""
        try:
            if self.camera:
                self.camera.release()
                self.camera = None
                self.camera_active = False
            
            self.sio.emit('camera_stop_response', {
                'requestId': data.get('requestId'),
                'success': True
            })
            print("Camera stopped")
            
        except Exception as e:
            self.sio.emit('camera_stop_response', {
                'requestId': data.get('requestId'),
                'success': False,
                'error': f"Failed to stop camera: {str(e)}"
            })
    
    def cleanup(self):
        """Clean up resources"""
        if self.serial_connection:
            try:
                self.serial_connection.close()
            except:
                pass
            self.serial_connection = None
            self.serial_port = None
        
        if self.camera:
            try:
                self.camera.release()
            except:
                pass
            self.camera = None
            self.camera_active = False
    
    def connect(self):
        """Connect to the IDE server"""
        try:
            print(f"Connecting to {self.server_url}/agent...")
            self.sio.connect(f"{self.server_url}/agent")
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False
    
    def run(self):
        """Main run loop"""
        if not self.connect():
            return False
        
        try:
            print("Hardware Agent running. Press Ctrl+C to stop.")
            self.sio.wait()
        except KeyboardInterrupt:
            print("\nShutting down...")
        finally:
            self.cleanup()
            self.sio.disconnect()
        
        return True

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='CodeCraft IDE Hardware Agent')
    parser.add_argument('--server', '-s', 
                       default='http://localhost:9000',
                       help='IDE server URL (default: http://localhost:9000)')
    parser.add_argument('--agent-id', '-i',
                       help='Agent ID (default: auto-generated)')
    parser.add_argument('--auth-token', '-t',
                       help='Authentication token (default: from AGENT_AUTH_TOKEN env)')
    
    args = parser.parse_args()
    
    # Create and run agent
    agent = HardwareAgent(
        server_url=args.server,
        agent_id=args.agent_id,
        auth_token=args.auth_token
    )
    
    success = agent.run()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
