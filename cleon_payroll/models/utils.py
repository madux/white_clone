from odoo import models, fields, api, _
from odoo.exceptions import UserError
import base64
import io
import re
import logging
import requests
import fitz
import ollama
import json
from io import BytesIO
_logger = logging.getLogger(__name__)

def extract_resume_text(file):
    if not file:
        return ""
    pdf_content = base64.b64decode(file)
    doc = fitz.open(
        stream= BytesIO(pdf_content).read(),
        filetype="pdf"
    )
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

# def generate_text_with_ai(raw_text,model='llama3', schema={"result": ""}):
#     # try:
#     # prompt = f"""
#     # \"\"\"{raw_text[:8000]}\"\"\"
#     # """
#     prompt = raw_text
#     response = ollama.chat(
#         model=model,
#         messages=[{'role': 'user', 'content': prompt}],
#         format='json',          # forces structured JSON output, no free text
#         keep_alive='30m',       # keep model loaded in RAM between calls
#         options={
#             'num_predict': 800, # cap output length -> faster
#             'temperature': 0,   # deterministic, slightly faster + more consistent
#         },
#     )

#     content = response['message']['content']
#     if not content:
#         _logger.info(f"AI could not return any data")
#         return None

#     # try:
#     data = json.loads(content)
#     raise UserError(f"DATA AI  NOFOUND {content}")
        
    # except json.JSONDecodeError:
    #     _logger.info("Ai Model returned invalid JSON:", content)
    #     return None
    # call using data.result
    return data

    # except Exception as e:
    #     print("CV parsing failed:", e)
    #     return None

from odoo.exceptions import UserError
import json
import ollama
import logging

_logger = logging.getLogger(__name__)


import json
import logging
import ollama

_logger = logging.getLogger(__name__)


def generate_text_with_ai(raw_text, model="llama3"):
    """
    Ask Ollama to generate Python code based on the supplied requirements.

    Returns:
        dict:
        {
            "explanation": "...",
            "python_code": "..."
        }
    """

    if not raw_text:
        return None

    prompt = f"""
    You are an expert Python developer specializing in
    Nigerian payroll, taxation, and development.

    The user wants you to generate computation / Python code based
    Return exactly this structure:
    see the full request of what the user wanted below

    {{
        "explanation": "Short explanation of what the code does",
        "python_code": "complete valid python payroll Python code here"
    }}

    USER REQUIREMENT:
    {raw_text[:12000]}
    """

    try:
        response = ollama.chat(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            format="json",
            keep_alive="10m",
            options={
                "temperature": 0,
                "num_predict": 800,
                "num_ctx": 4096, 
            },
        )
  
        _logger.info("OLLAMA RESPONSE: %s", response)

        # Support Ollama object response
        if hasattr(response, "message"):
            content = response.message.content
        else:
            content = response.get("message", {}).get("content")

        if not content:
            _logger.warning("Ollama returned empty content")
            return None

        _logger.info("OLLAMA CONTENT: %s", content)

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            _logger.error(
                "Ollama returned invalid JSON: %s",
                content
            )
            return None

        explanation = data.get("explanation")
        python_code = data.get("python_code")

        if not python_code:
            _logger.warning(
                "Ollama did not return python_code: %s",
                data
            )
            return None

        return data
        # explanation = data.get("explanation")
        # , explanation, python_code

    except Exception as e:
        _logger.exception("Ollama AI generation failed: %s", e)
        return None
    
def return_data_result(file, extract_option='ai'):
    raw_text = extract_resume_text(file)
    if extract_option == "ai":
        raw_text = raw_text + '''Note: the code to generate must be python readable structure eg. gross = categories.GROSS or (rules.BASIC + rules.HOUSING)
        if gross <= 300000:
            result = gross * 0.07
        else:
            result = gross * 0.11'''
        data = generate_text_with_ai(raw_text)
        if not data: 
            raise UserError(_("AI Could not extract any text from this file."))
        # raise UserError(data)
        data_extracted = data
    return data_extracted
    