"""Check retained draft bytes and source pairs; never certify language or runtime."""

from pathlib import Path
import hashlib
import json
import re


def strict_json(text):
    def unique(items):
        result = {}
        for key, value in items:
            assert key not in result, "duplicate JSON key"
            result[key] = value
        return result

    return json.loads(text, object_pairs_hook=unique)


def literals(text):
    return sorted(re.findall(r"\{[^{}]+\}|\b(?:UTC|DEMO|CSV)\b|\d+(?:[.,]\d+)?", text))


def validate(base):
    manifest = strict_json((base / "manifest.json").read_text())
    assert manifest["status"] == "unreviewed-ai-draft"
    for field in ["runtimeActivation", "humanFluentApproval", "browserRtlPrintApproved",
                  "allCurrentSourceFingerprintsMatched"]:
        assert manifest[field] is False
    locales = ["ar", "ur", "ne", "vi"]
    assert manifest["locales"] == locales
    expected = {"sowing": 32, "progress": 27, "batch-references": 28}
    assert [family["id"] for family in manifest["families"]] == list(expected)
    total = 0
    for family in manifest["families"]:
        folder = base / family["id"]
        names = {"source.json", "ar.json", "ur.json", "ne.json", "vi.json",
                 "review-notes.md", "status.json", "coordinator-source-context.json"}
        assert {Path(row["path"]).name for row in family["files"]} == names
        assert len(family["files"]) == len(names)
        for row in family["files"]:
            relative = Path(row["path"])
            assert relative.parts == (family["id"], relative.name)
            raw = (base / relative).read_bytes()
            assert len(raw) == row["bytes"]
            assert hashlib.sha256(raw).hexdigest() == row["sha256"], relative
            text = raw.decode("utf-8")
            assert "/Users/" not in text and "file://" not in text
        raw = (folder / "source.json").read_bytes()
        assert hashlib.sha256(raw).hexdigest() == family["sourceSha256"]
        source = strict_json(raw.decode("utf-8"))
        count = expected[family["id"]]
        assert family["messagesPerLocale"] == count and family["pairs"] == count * 4
        assert len(source["messages"]) == count
        keys = [row["key"] for row in source["messages"]]
        assert len(set(keys)) == count
        for row in source["messages"]:
            assert hashlib.sha256(row["english"].encode()).hexdigest() == row["messageSha256"]
        for locale in locales:
            packet = strict_json((folder / (locale + ".json")).read_text())
            assert set(packet) == {"locale", "sourceSha256", "status", "runtimeActivation", "messages"}
            assert packet["locale"] == locale and packet["sourceSha256"] == family["sourceSha256"]
            assert packet["status"] == "unreviewed-ai-draft" and packet["runtimeActivation"] is False
            assert len(packet["messages"]) == count
            for original, row in zip(source["messages"], packet["messages"]):
                assert set(row) == {"key", "english", "messageSha256", "translation"}
                for key in ["key", "english", "messageSha256"]:
                    assert row[key] == original[key]
                translated = row["translation"]
                assert isinstance(translated, str) and translated.strip() and translated != original["english"]
                assert literals(translated) == literals(original["english"])
                assert not re.search(r"<[^>]+>|\*\*|^\s*#{1,6}\s", translated)
                assert not re.search(r"[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]", translated)
            total += count
        notes = (folder / "review-notes.md").read_text()
        assert len(notes.split()) == family["notesWords"] <= family["notesWordCap"]
        status = strict_json((folder / "status.json").read_text())
        assert set(status) == {"executor", "locales", "pairs", "sourceSha256", "humanApproval",
                               "runtimeActivation", "commandsRun", "testsRun", "validation", "workersActive"}
        assert status["executor"] == "AGY" and status["locales"] == locales
        assert status["pairs"] == count * 4 and status["sourceSha256"] == family["sourceSha256"]
        for key in ["humanApproval", "runtimeActivation", "commandsRun", "testsRun"]:
            assert status[key] is False
        assert status["validation"] == "UNKNOWN" and type(status["workersActive"]) is int
        assert status["workersActive"] == 0
        context = strict_json((folder / "coordinator-source-context.json").read_text())
        assert context["generationSourceSha256"] == family["sourceSha256"]
        matched = sum(row["wholeFileFingerprintMatched"] is True for row in context["files"])
        assert matched == family["historicalSourceFilesMatched"]
        assert len(context["files"]) - matched == family["historicalSourceFilesChanged"]
        assert [row["key"] for row in context["selectedMessages"]] == keys
    assert total == manifest["totalTranslationPairs"] == 348
    return total


if __name__ == "__main__":
    print(f"Verified {validate(Path(__file__).resolve().parent)} retained AI source pairs; no fluent or runtime approval.")
