# CodeCraft IDE Hardware Agent

The Hardware Agent enables remote hardware control from the CodeCraft IDE. It runs locally on your macOS machine and connects to the remote IDE server via secure WebSocket.

## Features

- **Serial/USB Communication**: List ports, connect, read/write data
- **Secure Authentication**: Token-based agent registration
- **Real-time Communication**: Live serial console in IDE
- **Multi-agent Support**: Multiple agents can connect to one server

## Installation

1. **Install Python Dependencies**:
   ```bash
   cd /Users/saurabh/IDE-BUILD/agent
   pip3 install -r requirements.txt
   ```

2. **Optional: Install Additional Hardware Libraries**:
   ```bash
   # For camera support (future)
   pip3 install opencv-python
   
   # For audio support (future)
   pip3 install sounddevice
   
   # For USB device support (future)
   brew install libusb
   pip3 install pyusb
   ```

## Usage

### Basic Usage (Local Server)
```bash
python3 hardware_agent.py --server http://localhost:9000
```

### Remote Server Usage
```bash
python3 hardware_agent.py --server https://your-server.com:9000
```

### Custom Agent ID and Auth Token
```bash
python3 hardware_agent.py \
  --server https://your-server.com:9000 \
  --agent-id "my-mac-studio" \
  --auth-token "your-secure-token"
```

### Environment Variables
You can also set the auth token via environment variable:
```bash
export AGENT_AUTH_TOKEN="your-secure-token"
python3 hardware_agent.py --server https://your-server.com:9000
```

## IDE Integration

1. **Start the IDE Server** (if running locally):
   ```bash
   cd /Users/saurabh/IDE-BUILD/server
   node index.js
   ```

2. **Start the Hardware Agent**:
   ```bash
   cd /Users/saurabh/IDE-BUILD/agent
   python3 hardware_agent.py
   ```

3. **Open IDE in Browser**: http://localhost:9000

4. **Enable Hardware Mode**:
   - Click the microchip icon (🔧) in the toolbar
   - Switch to the "Hardware" panel in the right sidebar

5. **Connect to Serial Device**:
   - Select your agent from the dropdown
   - Click "Refresh Ports" to list available serial ports
   - Choose a port and baud rate
   - Click "Connect"
   - Use the serial console to send/receive data

## Supported Hardware

### Serial/USB Devices
- Arduino boards (Uno, Nano, ESP32, etc.)
- USB-to-Serial adapters (FTDI, CP2102, etc.)
- Any device with a serial interface

### Future Support (Planned)
- **Camera**: USB webcams, built-in cameras
- **Audio**: Microphones, speakers, audio interfaces
- **USB HID**: Custom USB devices
- **I2C/SPI**: Via USB adapters (FTDI, etc.)

## Security

- **Authentication**: All agents must provide a valid auth token
- **Local Network**: Agent connects to server, not vice versa
- **Encrypted**: Uses WebSocket Secure (WSS) for HTTPS servers

## Troubleshooting

### Agent Won't Connect
- Check server URL and port
- Verify auth token matches server expectation
- Ensure server is running and accessible

### Serial Port Issues
- Check device permissions: `ls -la /dev/tty*`
- On macOS, you may need to grant Terminal/Python accessibility permissions
- Ensure device drivers are installed (especially for USB-to-Serial adapters)

### Permission Errors
```bash
# Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER

# On macOS, check System Preferences > Security & Privacy
```

## Development

### Adding New Hardware Support
1. Add handler methods to `HardwareAgent` class
2. Add corresponding Socket.IO events
3. Update server routing in `server/index.js`
4. Add UI controls in IDE frontend

### Testing
```bash
# Test serial port listing
python3 -c "import serial.tools.list_ports; print([p.device for p in serial.tools.list_ports.comports()])"

# Test Socket.IO connection
python3 hardware_agent.py --server http://localhost:9000
```

## Example: Arduino Communication

1. **Upload simple sketch to Arduino**:
   ```cpp
   void setup() {
     Serial.begin(115200);
   }
   
   void loop() {
     if (Serial.available()) {
       String data = Serial.readString();
       Serial.print("Echo: ");
       Serial.println(data);
     }
     delay(100);
   }
   ```

2. **Connect via IDE**:
   - Select Arduino's port (e.g., `/dev/tty.usbserial-*`)
   - Set baud rate to 115200
   - Send "Hello Arduino" in serial console
   - See "Echo: Hello Arduino" response

## License

Part of CodeCraft IDE project.
