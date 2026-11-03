import pytest

from findhub import db


@pytest.fixture
def database(tmp_path):
    connection = db.connect(tmp_path / "findhub.db")
    yield connection
    connection.close()
