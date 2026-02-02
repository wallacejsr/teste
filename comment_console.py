import re
import sys

def comment_console_statements(content):
    """Comment out console statements instead of removing them"""
    # Pattern para console.log/info/warn/error em uma única linha
    pattern = r'^(\s*)(console\.(log|info|warn|error)\([^)]*\);?)$'
    return re.sub(pattern, r'\1// \2', content, flags=re.MULTILINE)

if __name__ == '__main__':
    filename = sys.argv[1]
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    cleaned = comment_console_statements(content)
    
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.write(cleaned)
    
    print(f'Commented console statements in {filename}')
