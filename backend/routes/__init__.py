"""Blueprint registration."""

from flask import Blueprint

from .resume import resume_bp
from .interview import interview_bp
from .project import project_bp
from .chat import chat_bp


def register_routes(app):
    app.register_blueprint(resume_bp, url_prefix="/api/resume")
    app.register_blueprint(interview_bp, url_prefix="/api/interview")
    app.register_blueprint(project_bp, url_prefix="/api/project")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")
