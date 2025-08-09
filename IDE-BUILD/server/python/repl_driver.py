#!/usr/bin/env python3
import sys
import json
import io
import contextlib

# Shared global/local namespace for persistent session
GLOBAL_ENV = {
    '__name__': '__main__'
}

# Simple protocol: each line is a JSON object {"code": str}
# We capture stdout/stderr and return {"stdout": str, "stderr": str, "ok": bool}

def process(code: str):
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    ok = True
    try:
        # Try exec first; fall back to eval for simple expressions to echo values
        compiled = None
        try:
            compiled = compile(code, '<repl>', 'exec')
            with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                exec(compiled, GLOBAL_ENV, GLOBAL_ENV)
        except SyntaxError:
            # Maybe it's an expression
            compiled = compile(code, '<repl>', 'eval')
            with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                result = eval(compiled, GLOBAL_ENV, GLOBAL_ENV)
                if result is not None:
                    print(repr(result))
    except Exception as e:
        ok = False
        import traceback
        traceback.print_exc(file=stderr_buf)
    return {
        'ok': ok,
        'stdout': stdout_buf.getvalue(),
        'stderr': stderr_buf.getvalue(),
    }


def main():
    # Signal ready
    sys.stdout.write("READY\n")
    sys.stdout.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == '__EXIT__':
            break
        try:
            msg = json.loads(line)
            code = msg.get('code', '')
        except Exception:
            resp = {'ok': False, 'stdout': '', 'stderr': 'Invalid JSON input'}
        else:
            resp = process(code)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()

if __name__ == '__main__':
    main()
