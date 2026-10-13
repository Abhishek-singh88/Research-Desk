from app.db.database import engine, Base
from app.models import document

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Done. The tables will be automatically recreated when you start the FastAPI server.")
