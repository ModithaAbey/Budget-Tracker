
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

url = "http://127.0.0.1:5000/api/transactions"

transaction = {
    "type": "expense",
    "description": "Lunch",
    "amount": 1500,
    "category": "Food",
    "date": "2026-10-22"
}

data = json.dumps(transaction).encode("utf-8")

request = Request(
    url,
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urlopen(request) as response:
        print("Status:", response.status)
        print(response.read().decode("utf-8"))
except HTTPError as error:
    print("Error:", error.code)
    print(error.read().decode("utf-8"))
