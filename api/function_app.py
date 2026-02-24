import azure.functions as func
from blueprints.ingest import bp as ingest_bp
from blueprints.web_api import bp as web_api_bp

app = func.FunctionApp()

app.register_functions(ingest_bp)
app.register_functions(web_api_bp)
from blueprints.settings_api import bp as settings_bp
app.register_functions(settings_bp)
from blueprints.health import bp as health_bp
app.register_functions(health_bp)
from blueprints.reporting import bp as reporting_bp
app.register_functions(reporting_bp)
from blueprints.slack_report import bp as slack_report_bp
app.register_functions(slack_report_bp)
