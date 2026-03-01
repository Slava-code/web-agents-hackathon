"""
Browser Use Cloud API Demo -- Flask Backend
Full trajectory tracking with live browser viewer.
"""

import asyncio
import os
import json
from flask import Flask, render_template, request, jsonify, Response
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from browser_use_sdk import AsyncBrowserUse

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/run", methods=["POST"])
def run_task():
    data = request.get_json()
    task_text = data.get("task", "")
    start_url = data.get("start_url", "")

    if not task_text:
        return jsonify({"error": "Task description is required"}), 400

    api_key = os.environ.get("BROWSER_USE_API_KEY")
    if not api_key:
        return jsonify({"error": "BROWSER_USE_API_KEY not set"}), 500

    def generate():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def stream_task():
            client = AsyncBrowserUse(api_key=api_key)

            # Create session first for live_url
            session = await client.sessions.create_session()
            live_url = getattr(session, "live_url", None)

            yield json.dumps({
                "type": "session",
                "session_id": session.id,
                "live_url": live_url,
            }) + "\n"

            create_kwargs = {"task": task_text, "session_id": session.id}
            if start_url:
                create_kwargs["start_url"] = start_url

            task = await client.tasks.create_task(**create_kwargs)

            yield json.dumps({
                "type": "created",
                "task_id": task.id,
            }) + "\n"

            # Stream every field from each step
            async for step in task.stream():
                yield json.dumps({
                    "type": "step",
                    "number": step.number,
                    "next_goal": getattr(step, "next_goal", ""),
                    "evaluation_previous_goal": getattr(step, "evaluation_previous_goal", ""),
                    "memory": getattr(step, "memory", ""),
                    "url": getattr(step, "url", ""),
                    "screenshot_url": getattr(step, "screenshot_url", None),
                    "actions": getattr(step, "actions", []),
                }) + "\n"

            # Final result with complete data
            result = await client.tasks.get_task(task.id)

            steps_data = []
            if hasattr(result, "steps") and result.steps:
                for s in result.steps:
                    steps_data.append({
                        "number": s.number,
                        "url": getattr(s, "url", ""),
                        "screenshot_url": getattr(s, "screenshot_url", None),
                        "next_goal": getattr(s, "next_goal", ""),
                        "evaluation_previous_goal": getattr(s, "evaluation_previous_goal", ""),
                        "memory": getattr(s, "memory", ""),
                        "actions": getattr(s, "actions", []),
                    })

            # Serialize output_files
            output_files = []
            if hasattr(result, "output_files") and result.output_files:
                for f in result.output_files:
                    output_files.append({
                        "id": getattr(f, "id", ""),
                        "file_name": getattr(f, "file_name", ""),
                        "download_url": getattr(f, "download_url", ""),
                    })

            yield json.dumps({
                "type": "done",
                "status": result.status,
                "output": result.output,
                "is_success": getattr(result, "is_success", None),
                "cost": getattr(result, "cost", None),
                "llm": getattr(result, "llm", None),
                "judge_verdict": getattr(result, "judge_verdict", None),
                "judgement": getattr(result, "judgement", None),
                "suggestions": getattr(result, "suggestions", None),
                "created_at": str(getattr(result, "created_at", "")),
                "started_at": str(getattr(result, "started_at", "")),
                "finished_at": str(getattr(result, "finished_at", "")),
                "output_files": output_files,
                "steps": steps_data,
            }) + "\n"

        async_gen = stream_task()

        try:
            while True:
                chunk = loop.run_until_complete(async_gen.__anext__())
                yield f"data: {chunk}\n\n"
        except StopAsyncIteration:
            pass
        finally:
            loop.close()

    return Response(generate(), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(debug=True, port=5001)
