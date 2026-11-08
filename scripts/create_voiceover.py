import asyncio
import os
import sys
import subprocess
import edge_tts

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

VOICE = "en-US-ChristopherNeural"  # Professional, confident, clear American male voice
AUDIO_DIR = os.path.abspath("audio_tracks")
FFMPEG_EXE = r"C:\Users\Vijay\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"

SEGMENTS = [
    {
        "id": "scene1",
        "text": "Welcome to InvoicePilot, the human-governed AI billing agent for freelancers, built for the PayPal AI Hackathon 2026. InvoicePilot combines the speed of conversational AI with the financial trust of the PayPal Invoicing API v2.",
        "pause_after": 1.5,
    },
    {
        "id": "scene2",
        "text": "Instead of wrestling with complex billing software, freelancers simply type what they need in plain English. Let's ask InvoicePilot to invoice Acme Corp $800 for logo design and brand guide, due in 14 days.",
        "pause_after": 2.0,
    },
    {
        "id": "scene3",
        "text": "InvoicePilot automatically retrieves Acme Corp's billing email from client memory and deterministically computes line item amounts in integer cents. Notice the AI cannot move money or send invoices. The proposal is locked in an Awaiting Approval state, protected by a cryptographic SHA-256 hash snapshot.",
        "pause_after": 2.0,
    },
    {
        "id": "scene4",
        "text": "What happens if a prompt injection or malicious script tampers with the price behind the scenes? Watch this. When we simulate a tamper attack, the server recomputes the SHA-256 hash. Because a single cent was modified, the backend halts dispatch with an immediate refusal and locks the record as TAMPERED.",
        "pause_after": 2.0,
    },
    {
        "id": "scene5",
        "text": "Let's inspect the Audit Trail. Here, the blocked tamper attempt is permanently recorded with exact cryptographic hashes alongside transparent PayPal REST API logs.",
        "pause_after": 2.0,
    },
    {
        "id": "scene6",
        "text": "Now let's approve the real invoice. When we click Approve and Send, the server securely dispatches the verified snapshot directly to the PayPal Invoicing API v2 in Sandbox, generating an authentic hosted PayPal payment portal.",
        "pause_after": 2.5,
    },
    {
        "id": "scene7",
        "text": "InvoicePilot also tracks overdue invoices using timezone-aware date math and drafts polite reminders with built-in PayPal rate limiting. With InvoicePilot, freelancers get paid faster with conversational simplicity, backed by PayPal security. Thank you!",
        "pause_after": 1.0,
    },
]

async def generate_audio():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    file_list_path = os.path.join(AUDIO_DIR, "concat_list.txt")
    concat_lines = []

    print("🎙️ Generating studio-quality AI voiceover tracks with edge-tts...")
    
    for i, seg in enumerate(SEGMENTS):
        out_file = os.path.join(AUDIO_DIR, f"{seg['id']}.mp3")
        tts = edge_tts.Communicate(seg["text"], VOICE, rate="+3%")
        await tts.save(out_file)
        print(f"  ✓ Generated: {seg['id']}.mp3")

        # Generate silence padding
        silence_file = os.path.join(AUDIO_DIR, f"{seg['id']}_silence.mp3")
        pause_sec = seg["pause_after"]
        cmd = [
            FFMPEG_EXE, "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo",
            "-t", str(pause_sec), "-q:a", "9", silence_file
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        concat_lines.append(f"file '{out_file.replace(os.sep, '/')}'")
        concat_lines.append(f"file '{silence_file.replace(os.sep, '/')}'")

    # Write concat list
    with open(file_list_path, "w", encoding="utf-8") as f:
        f.write("\n".join(concat_lines))

    # Concat all segments into master voiceover audio
    master_audio = os.path.join(AUDIO_DIR, "master_voiceover.mp3")
    concat_cmd = [
        FFMPEG_EXE, "-y", "-f", "concat", "-safe", "0", "-i", file_list_path,
        "-c", "copy", master_audio
    ]
    subprocess.run(concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(f"\n✅ Master voiceover generated: {master_audio}")

if __name__ == "__main__":
    asyncio.run(generate_audio())
