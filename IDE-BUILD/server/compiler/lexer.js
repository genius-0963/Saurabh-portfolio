/**
 * CraftLang Lexer - Tokenizes source code into tokens
 * Custom-built compiler component for CodeCraft IDE
 */

class Token {
    constructor(type, value, line, column) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
}

// Token types for CraftLang
const TokenType = {
    // Literals
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',
    IDENTIFIER: 'IDENTIFIER',
    
    // Keywords
    LET: 'LET',
    CONST: 'CONST',
    IF: 'IF',
    ELSE: 'ELSE',
    WHILE: 'WHILE',
    FOR: 'FOR',
    FUNCTION: 'FUNCTION',
    RETURN: 'RETURN',
    TRUE: 'TRUE',
    FALSE: 'FALSE',
    NULL: 'NULL',
    PRINT: 'PRINT',
    INPUT: 'INPUT',
    
    // Operators
    PLUS: 'PLUS',
    MINUS: 'MINUS',
    MULTIPLY: 'MULTIPLY',
    DIVIDE: 'DIVIDE',
    MODULO: 'MODULO',
    ASSIGN: 'ASSIGN',
    EQUAL: 'EQUAL',
    NOT_EQUAL: 'NOT_EQUAL',
    LESS_THAN: 'LESS_THAN',
    GREATER_THAN: 'GREATER_THAN',
    LESS_EQUAL: 'LESS_EQUAL',
    GREATER_EQUAL: 'GREATER_EQUAL',
    AND: 'AND',
    OR: 'OR',
    NOT: 'NOT',
    
    // Delimiters
    SEMICOLON: 'SEMICOLON',
    COMMA: 'COMMA',
    LEFT_PAREN: 'LEFT_PAREN',
    RIGHT_PAREN: 'RIGHT_PAREN',
    LEFT_BRACE: 'LEFT_BRACE',
    RIGHT_BRACE: 'RIGHT_BRACE',
    LEFT_BRACKET: 'LEFT_BRACKET',
    RIGHT_BRACKET: 'RIGHT_BRACKET',
    
    // Special
    NEWLINE: 'NEWLINE',
    EOF: 'EOF',
    ILLEGAL: 'ILLEGAL'
};

class CraftLangLexer {
    constructor(source) {
        this.source = source;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.currentChar = this.source[this.position];
        
        // Keywords mapping
        this.keywords = {
            'let': TokenType.LET,
            'const': TokenType.CONST,
            'if': TokenType.IF,
            'else': TokenType.ELSE,
            'while': TokenType.WHILE,
            'for': TokenType.FOR,
            'function': TokenType.FUNCTION,
            'return': TokenType.RETURN,
            'true': TokenType.TRUE,
            'false': TokenType.FALSE,
            'null': TokenType.NULL,
            'print': TokenType.PRINT,
            'input': TokenType.INPUT,
            'and': TokenType.AND,
            'or': TokenType.OR,
            'not': TokenType.NOT
        };
    }
    
    advance() {
        if (this.currentChar === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        
        this.position++;
        if (this.position >= this.source.length) {
            this.currentChar = null;
        } else {
            this.currentChar = this.source[this.position];
        }
    }
    
    peek() {
        const peekPos = this.position + 1;
        if (peekPos >= this.source.length) {
            return null;
        }
        return this.source[peekPos];
    }
    
    skipWhitespace() {
        while (this.currentChar && /\s/.test(this.currentChar) && this.currentChar !== '\n') {
            this.advance();
        }
    }
    
    skipComment() {
        if (this.currentChar === '/' && this.peek() === '/') {
            // Single line comment
            while (this.currentChar && this.currentChar !== '\n') {
                this.advance();
            }
        } else if (this.currentChar === '/' && this.peek() === '*') {
            // Multi-line comment
            this.advance(); // skip '/'
            this.advance(); // skip '*'
            
            while (this.currentChar) {
                if (this.currentChar === '*' && this.peek() === '/') {
                    this.advance(); // skip '*'
                    this.advance(); // skip '/'
                    break;
                }
                this.advance();
            }
        }
    }
    
    readNumber() {
        let numStr = '';
        let hasDot = false;
        
        while (this.currentChar && (/\d/.test(this.currentChar) || this.currentChar === '.')) {
            if (this.currentChar === '.') {
                if (hasDot) break;
                hasDot = true;
            }
            numStr += this.currentChar;
            this.advance();
        }
        
        return hasDot ? parseFloat(numStr) : parseInt(numStr);
    }
    
    readString() {
        const quote = this.currentChar;
        let str = '';
        this.advance(); // skip opening quote
        
        while (this.currentChar && this.currentChar !== quote) {
            if (this.currentChar === '\\') {
                this.advance();
                if (this.currentChar === 'n') str += '\n';
                else if (this.currentChar === 't') str += '\t';
                else if (this.currentChar === 'r') str += '\r';
                else if (this.currentChar === '\\') str += '\\';
                else if (this.currentChar === quote) str += quote;
                else str += this.currentChar;
            } else {
                str += this.currentChar;
            }
            this.advance();
        }
        
        if (this.currentChar === quote) {
            this.advance(); // skip closing quote
        }
        
        return str;
    }
    
    readIdentifier() {
        let identifier = '';
        
        while (this.currentChar && (/[a-zA-Z_$]/.test(this.currentChar) || 
               (identifier.length > 0 && /\d/.test(this.currentChar)))) {
            identifier += this.currentChar;
            this.advance();
        }
        
        return identifier;
    }
    
    getNextToken() {
        while (this.currentChar) {
            const line = this.line;
            const column = this.column;
            
            // Skip whitespace
            if (/\s/.test(this.currentChar) && this.currentChar !== '\n') {
                this.skipWhitespace();
                continue;
            }
            
            // Handle newlines
            if (this.currentChar === '\n') {
                this.advance();
                return new Token(TokenType.NEWLINE, '\n', line, column);
            }
            
            // Skip comments
            if (this.currentChar === '/' && (this.peek() === '/' || this.peek() === '*')) {
                this.skipComment();
                continue;
            }
            
            // Numbers
            if (/\d/.test(this.currentChar)) {
                return new Token(TokenType.NUMBER, this.readNumber(), line, column);
            }
            
            // Strings
            if (this.currentChar === '"' || this.currentChar === "'") {
                return new Token(TokenType.STRING, this.readString(), line, column);
            }
            
            // Identifiers and keywords
            if (/[a-zA-Z_$]/.test(this.currentChar)) {
                const identifier = this.readIdentifier();
                const tokenType = this.keywords[identifier] || TokenType.IDENTIFIER;
                return new Token(tokenType, identifier, line, column);
            }
            
            // Two-character operators
            if (this.currentChar === '=' && this.peek() === '=') {
                this.advance();
                this.advance();
                return new Token(TokenType.EQUAL, '==', line, column);
            }
            
            if (this.currentChar === '!' && this.peek() === '=') {
                this.advance();
                this.advance();
                return new Token(TokenType.NOT_EQUAL, '!=', line, column);
            }
            
            if (this.currentChar === '<' && this.peek() === '=') {
                this.advance();
                this.advance();
                return new Token(TokenType.LESS_EQUAL, '<=', line, column);
            }
            
            if (this.currentChar === '>' && this.peek() === '=') {
                this.advance();
                this.advance();
                return new Token(TokenType.GREATER_EQUAL, '>=', line, column);
            }
            
            // Single-character tokens
            const char = this.currentChar;
            this.advance();
            
            switch (char) {
                case '+': return new Token(TokenType.PLUS, '+', line, column);
                case '-': return new Token(TokenType.MINUS, '-', line, column);
                case '*': return new Token(TokenType.MULTIPLY, '*', line, column);
                case '/': return new Token(TokenType.DIVIDE, '/', line, column);
                case '%': return new Token(TokenType.MODULO, '%', line, column);
                case '=': return new Token(TokenType.ASSIGN, '=', line, column);
                case '<': return new Token(TokenType.LESS_THAN, '<', line, column);
                case '>': return new Token(TokenType.GREATER_THAN, '>', line, column);
                case '!': return new Token(TokenType.NOT, '!', line, column);
                case ';': return new Token(TokenType.SEMICOLON, ';', line, column);
                case ',': return new Token(TokenType.COMMA, ',', line, column);
                case '(': return new Token(TokenType.LEFT_PAREN, '(', line, column);
                case ')': return new Token(TokenType.RIGHT_PAREN, ')', line, column);
                case '{': return new Token(TokenType.LEFT_BRACE, '{', line, column);
                case '}': return new Token(TokenType.RIGHT_BRACE, '}', line, column);
                case '[': return new Token(TokenType.LEFT_BRACKET, '[', line, column);
                case ']': return new Token(TokenType.RIGHT_BRACKET, ']', line, column);
                default:
                    return new Token(TokenType.ILLEGAL, char, line, column);
            }
        }
        
        return new Token(TokenType.EOF, null, this.line, this.column);
    }
    
    tokenize() {
        const tokens = [];
        let token;
        
        do {
            token = this.getNextToken();
            if (token.type !== TokenType.NEWLINE) { // Skip newlines in token list
                tokens.push(token);
            }
        } while (token.type !== TokenType.EOF);
        
        return tokens;
    }
}

module.exports = { CraftLangLexer, Token, TokenType };
