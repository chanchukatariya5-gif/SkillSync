import os
import re
from io import BytesIO

import pdfplumber
from flask import Flask, jsonify, request
from pdfplumber.utils.exceptions import PdfminerException

app = Flask(__name__)
MAX_RESUME_BYTES = 5 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_RESUME_BYTES + 64 * 1024

SKILLS = {
    "Python": ("technical", ["python"]),
    "Java": ("technical", ["java"]),
    "C++": ("technical", ["c++"]),
    "JavaScript": ("technical", ["javascript", "js"]),
    "React": ("technical", ["react"]),
    "Node.js": ("technical", ["node.js", "nodejs"]),
    "HTML": ("technical", ["html"]),
    "CSS": ("technical", ["css"]),
    "MySQL": ("technical", ["mysql"]),
    "MongoDB": ("technical", ["mongodb"]),
    "SQL": ("technical", ["sql"]),
    "GitHub": ("technical", ["github"]),
    "Git": ("technical", ["git"]),
    "Jira": ("technical", ["jira"]),
    "Power BI": ("technical", ["power bi"]),
    "Excel": ("technical", ["excel", "ms-excel", "microsoft excel"]),
    "SharePoint": ("technical", ["sharepoint"]),
    "Confluence": ("technical", ["confluence"]),
    "Smartsheet": ("technical", ["smartsheet"]),
    "Agile": ("technical", ["agile"]),
    "Data Analysis": ("technical", ["data analysis"]),
    "Data Visualization": ("technical", ["data visualization"]),
    "Project Planning": ("soft", ["project planning"]),
    "Stakeholder Management": ("soft", ["stakeholder management"]),
    "Team Collaboration": ("soft", ["team collaboration"]),
    "Problem Solving": ("soft", ["problem solving"]),
    "Machine Learning": ("technical", ["machine learning"]),
    "Deep Learning": ("technical", ["deep learning"]),
    "TensorFlow": ("technical", ["tensorflow"]),
    "PyTorch": ("technical", ["pytorch"]),
}


def extract_text(pdf_file):
    with pdfplumber.open(pdf_file) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def extract_skills(text):
    normalized_text = text.lower()
    found = []
    for skill, (_, keywords) in SKILLS.items():
        for keyword in keywords:
            pattern = rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])"
            if re.search(pattern, normalized_text):
                found.append(skill)
                break
    return found


def extract_contact(text):
    email_match = re.search(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", text, re.IGNORECASE)
    name = next(
        (line.strip() for line in text.splitlines() if 1 < len(line.strip()) <= 80 and "@" not in line),
        "",
    )
    return name, email_match.group(0) if email_match else ""


@app.get("/")
def home():
    return jsonify({"message": "SkillSync Resume Service", "status": "running"})


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "Resume must be 5 MB or smaller."}), 413


@app.post("/analyze")
def analyze_resume():
    file = request.files.get("resume")
    if file is None:
        return jsonify({"error": "No resume uploaded."}), 400
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported."}), 400

    content = file.read()
    if len(content) > MAX_RESUME_BYTES:
        return jsonify({"error": "Resume must be 5 MB or smaller."}), 413
    if not content.startswith(b"%PDF-"):
        return jsonify({"error": "The uploaded file is not a valid PDF."}), 400

    try:
        text = extract_text(BytesIO(content))
    except (PdfminerException, ValueError, OSError) as error:
        app.logger.info("Unable to read uploaded PDF: %s", error)
        return jsonify({"error": "Unable to read this PDF. Please try another file."}), 422

    if not text.strip():
        return jsonify({"error": "Could not extract text from PDF. Scanned PDFs are not supported."}), 422

    skills = extract_skills(text)
    technical_skills = [skill for skill in skills if SKILLS[skill][0] == "technical"]
    soft_skills = [skill for skill in skills if SKILLS[skill][0] == "soft"]
    name, email = extract_contact(text)
    return jsonify({
        "success": True,
        "filename": file.filename,
        "name": name,
        "email": email,
        "extracted_text": text[:100000],
        "skills": skills,
        "technical_skills": technical_skills,
        "soft_skills": soft_skills,
        "total_skills": len(skills),
    })


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", "8000")), debug=False)
