import re


def to_camel(value: str) -> str:
    return re.sub(r'_([a-z])', lambda match: match.group(1).upper(), value)
