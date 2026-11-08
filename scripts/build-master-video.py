import os
import sys
import subprocess
import glob
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

FFMPEG_EXE = r"C:\Users\Vijay\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
AUDIO_TRACK = os.path.abspath("audio_tracks/master_voiceover.mp3")
VIDEOS_DIR = os.path.abspath("videos")
FINAL_OUTPUT = os.path.join(VIDEOS_DIR, "InvoicePilot_Official_Demo_FullHD_1080p.mp4")

def run():
    print("==================================================================")
    print("🚀 InvoicePilot: Master Full HD 1080p Video Production Pipeline")
    print("==================================================================\n")

    # Step 1: Clean old video files in videos/
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    for old_f in glob.glob(os.path.join(VIDEOS_DIR, "*.webm")):
        try:
            os.remove(old_f)
        except Exception:
            pass

    # Step 2: Run Playwright Master 1080p recording
    print("🎥 Step 1/3: Launching Playwright Full HD recording (1920x1080 @ 60fps)...")
    start_time = time.time()
    res = subprocess.run(["node", "scripts/record-master-1080p.mjs"], cwd=os.getcwd())
    if res.returncode != 0:
        print("❌ Playwright recording failed.")
        sys.exit(1)
    
    # Step 3: Locate the recorded .webm file
    recorded_webms = glob.glob(os.path.join(VIDEOS_DIR, "*.webm"))
    if not recorded_webms:
        print("❌ No recorded webm file found in videos directory.")
        sys.exit(1)
    
    raw_video = recorded_webms[0]
    print(f"  ✓ Raw high-DPI video captured: {raw_video} ({os.path.getsize(raw_video) / (1024*1024):.1f} MB)")

    # Step 4: Merge Video & Voiceover, Trim Initial Pre-load (~1.5s), Encode to 1080p MP4
    print("\n🎬 Step 2/3: Merging video with neural AI voiceover and encoding 1080p H.264...")
    
    # The pre-load took ~1.5s after networkidle. We trim -ss 00:00:01.5 so the video opens IMMEDIATELY on the active UI!
    ffmpeg_cmd = [
        FFMPEG_EXE, "-y",
        "-ss", "00:00:01.5",
        "-i", raw_video,
        "-i", AUDIO_TRACK,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "17",               # Visually lossless high-bitrate quality
        "-pix_fmt", "yuv420p",      # Maximum compatibility with YouTube & all video players
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",                # Match shortest stream duration
        FINAL_OUTPUT
    ]

    subprocess.run(ffmpeg_cmd, check=True)
    
    size_mb = os.path.getsize(FINAL_OUTPUT) / (1024 * 1024)
    print("\n==================================================================")
    print(f"🎉 MASTER FULL HD DEMO VIDEO COMPLETED!")
    print(f"📁 Output File: {FINAL_OUTPUT}")
    print(f"📊 Resolution: 1920x1080 Full HD (H.264 / AAC)")
    print(f"📦 File Size: {size_mb:.2f} MB")
    print("==================================================================\n")

if __name__ == "__main__":
    run()
