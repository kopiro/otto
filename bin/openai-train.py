import csv
import json
import os

dir_path = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
train_csv = dir_path + "/cache/openai-train.csv"
train_jsonl = dir_path + "/cache/openai-train.jsonl"

os.system('curl -L "https://docs.google.com/spreadsheets/d/1SikpF9M2MkRoiCvqxfqrCRArFt7G9OP_Z75ip2A8nkQ/export?format=csv" -o "' + train_csv + '"')

with open(train_jsonl, "w") as jsonl:
  with open(dir_path + "/cache/openai-train.txt", "w") as txt:
    with open(train_csv, 'r') as file:
      csvreader = csv.reader(file)
      for row in csvreader:
        prompt = "Q: " + row[0].strip() + "\n" + "A:"
        completion = " " + row[1].strip() + "\n"
        jsonl.write(json.dumps({
          "prompt": prompt,
          "completion": completion
        }) + "\n")
        txt.write(prompt + completion)

os.system("openai tools fine_tunes.prepare_data -f ./cache/openai-train.jsonl")

print("\n\nRun this command to tune the model: \n")
print('openai api fine_tunes.create -t "{}" -m curie --suffix otto'.format(train_jsonl))