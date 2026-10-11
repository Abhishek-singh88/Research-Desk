import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

try:
    print("Testing gemini-2.5-flash...")
    model = genai.GenerativeModel('gemini-2.5-flash')
    res = model.generate_content("hello")
    print("Success!")
except Exception as e:
    print(f"Error: {e}")

try:
    print("Testing gemini-embedding-2...")
    res = genai.embed_content(model="models/gemini-embedding-2", content="hello", task_type="retrieval_query")
    print("Success!")
except Exception as e:
    print(f"Error: {e}")

try:
    print("Testing gemini-2.5-pro...")
    model = genai.GenerativeModel('gemini-2.5-pro')
    res = model.generate_content("hello")
    print("Success!")
except Exception as e:
    print(f"Error: {e}")
