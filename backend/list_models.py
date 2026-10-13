import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

print("Available models:")
for m in genai.list_models():
    print(f"Name: {m.name}")
    print(f"Supported generation methods: {m.supported_generation_methods}")
    print("---")
