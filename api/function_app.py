import azure.functions as func
from blueprints.ingest import bp as ingest_bp
from blueprints.web_api import bp as web_api_bp

app = func.FunctionApp()

app.register_functions(ingest_bp)
app.register_functions(web_api_bp)
