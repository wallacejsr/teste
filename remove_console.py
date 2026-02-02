import re
import sys

def remove_console_statements(content):
    """Remove console statements handling multi-line calls"""
    # Pattern para console.log/info/warn/error com suporte a multi-linha
    pattern = r'console\.(log|info|warn|error)\([^)]*(?:\([^)]*\)[^)]*)*\);?'
    return re.sub(pattern, '', content, flags=re.DOTALL)

if __name__ == '__main__':
    filename = sys.argv[1]
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    cleaned = remove_console_statements(content)
    
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.write(cleaned)
    
    print(f'Cleaned {filename}')
