This folder holds the portable Node.js runtime so teachers don't need to install anything.

HOW TO POPULATE IT (one-time, done by the developer before zipping):
======================================================================

1. Go to: https://nodejs.org/en/download
2. Under "Prebuilt Binaries", choose:
   - OS: Windows
   - Architecture: x64
   - Package type: zip  ← important, not the installer
3. Download and extract the zip (e.g. node-v22.x.x-win-x64.zip)
4. Copy ONLY these files into THIS (bin/) folder:
     node.exe
     (no other files needed — node.exe is fully self-contained)

Optional — whisper.cpp (for future offline transcription):
======================================================================

1. Go to: https://github.com/ggerganov/whisper.cpp/releases
2. Download the latest Windows release zip (e.g. whisper-bin-Win32.zip or x64)
3. Extract and copy into bin/whisper/:
     whisper.exe   (or main.exe depending on release)
     ggml-tiny.en.bin   ← smallest English-only model (~75MB)
     Any .dll files that came with the release (openblas.dll etc.)

After adding node.exe, the START.bat launcher will automatically
use it instead of requiring Node.js to be installed on the teacher's PC.

File sizes (approx):
  node.exe              ~  30 MB
  whisper.exe           ~   3 MB
  ggml-tiny.en.bin      ~  75 MB  (smallest model)
  ggml-base.en.bin      ~ 142 MB  (better accuracy, still fast)
