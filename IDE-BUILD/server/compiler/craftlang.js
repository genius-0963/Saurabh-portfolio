/**
 * CraftLang Compiler - Main compiler interface
 * Custom-built compiler for CodeCraft IDE
 */

const { CraftLangLexer } = require('./lexer');
const { CraftLangParser } = require('./parser');
const { CraftLangInterpreter } = require('./interpreter');

class CraftLangCompiler {
    constructor() {
        this.version = '1.0.0';
        this.languageName = 'CraftLang';
    }
    
    compile(sourceCode, options = {}) {
        const result = {
            success: false,
            output: '',
            errors: [],
            ast: null,
            tokens: null,
            executionTime: 0
        };
        
        try {
            const startTime = Date.now();
            
            // Phase 1: Lexical Analysis
            const lexer = new CraftLangLexer(sourceCode);
            const tokens = lexer.tokenize();
            result.tokens = tokens;
            
            if (options.debug) {
                result.output += '=== TOKENS ===\n';
                tokens.forEach(token => {
                    if (token.type !== 'EOF') {
                        result.output += `${token.type}: ${token.value} (${token.line}:${token.column})\n`;
                    }
                });
                result.output += '\n';
            }
            
            // Phase 2: Syntax Analysis (Parsing)
            const parser = new CraftLangParser(tokens);
            const ast = parser.parse();
            result.ast = ast;
            
            if (options.debug) {
                result.output += '=== AST ===\n';
                result.output += JSON.stringify(ast, null, 2) + '\n\n';
            }
            
            // Phase 3: Execution (Interpretation)
            if (!options.parseOnly) {
                result.output += '=== EXECUTION ===\n';
                
                const interpreter = new CraftLangInterpreter(
                    // Output callback
                    (text) => {
                        result.output += text + '\n';
                    },
                    // Input callback (for now, return empty string)
                    (prompt) => {
                        result.output += prompt;
                        return options.input || '';
                    }
                );
                
                const executionResult = interpreter.interpret(ast);
                
                if (options.debug && executionResult !== null) {
                    result.output += `\nProgram returned: ${interpreter.stringify(executionResult)}\n`;
                }
            }
            
            const endTime = Date.now();
            result.executionTime = endTime - startTime;
            result.success = true;
            
        } catch (error) {
            result.errors.push({
                type: 'CompilationError',
                message: error.message,
                line: error.line || 0,
                column: error.column || 0
            });
            result.output += `Error: ${error.message}\n`;
        }
        
        return result;
    }
    
    getLanguageInfo() {
        return {
            name: this.languageName,
            version: this.version,
            description: 'A custom programming language built for CodeCraft IDE',
            features: [
                'Variables (let, const)',
                'Functions',
                'Control flow (if/else, while, for)',
                'Arithmetic and logical operations',
                'Built-in print and input functions',
                'Type coercion',
                'Lexical scoping'
            ],
            syntax: {
                variables: 'let x = 10; const PI = 3.14;',
                functions: 'function add(a, b) { return a + b; }',
                conditionals: 'if (x > 0) { print("positive"); } else { print("negative"); }',
                loops: 'while (i < 10) { print(i); i = i + 1; }',
                io: 'print("Hello World"); let name = input("Enter name: ");'
            }
        };
    }
    
    validateSyntax(sourceCode) {
        try {
            const lexer = new CraftLangLexer(sourceCode);
            const tokens = lexer.tokenize();
            const parser = new CraftLangParser(tokens);
            parser.parse();
            return { valid: true, errors: [] };
        } catch (error) {
            return {
                valid: false,
                errors: [{
                    message: error.message,
                    line: error.line || 0,
                    column: error.column || 0
                }]
            };
        }
    }
    
    formatCode(sourceCode) {
        // Basic code formatting (can be enhanced)
        let formatted = sourceCode;
        let indentLevel = 0;
        const lines = formatted.split('\n');
        const formattedLines = [];
        
        for (let line of lines) {
            line = line.trim();
            if (!line) {
                formattedLines.push('');
                continue;
            }
            
            // Decrease indent for closing braces
            if (line.startsWith('}')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add indentation
            const indent = '    '.repeat(indentLevel);
            formattedLines.push(indent + line);
            
            // Increase indent for opening braces
            if (line.endsWith('{')) {
                indentLevel++;
            }
        }
        
        return formattedLines.join('\n');
    }
    
    getExamples() {
        return {
            'Hello World': `print("Hello, World!");`,
            
            'Variables': `let name = "CraftLang";
let version = 1.0;
const PI = 3.14159;

print("Language: " + name);
print("Version: " + version);
print("PI: " + PI);`,

            'Functions': `function greet(name) {
    return "Hello, " + name + "!";
}

function factorial(n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

print(greet("World"));
print("5! = " + factorial(5));`,

            'Control Flow': `let x = 10;

if (x > 5) {
    print("x is greater than 5");
} else {
    print("x is 5 or less");
}

let i = 1;
while (i <= 5) {
    print("Count: " + i);
    i = i + 1;
}`,

            'Interactive Program': `let name = input("What's your name? ");
print("Nice to meet you, " + name + "!");

let age = toNumber(input("How old are you? "));
if (age >= 18) {
    print("You're an adult!");
} else {
    print("You're a minor!");
}`,

            'Calculator': `function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }
function multiply(a, b) { return a * b; }
function divide(a, b) { 
    if (b == 0) {
        print("Error: Division by zero!");
        return null;
    }
    return a / b; 
}

let a = 10;
let b = 3;

print("Addition: " + a + " + " + b + " = " + add(a, b));
print("Subtraction: " + a + " - " + b + " = " + subtract(a, b));
print("Multiplication: " + a + " * " + b + " = " + multiply(a, b));
print("Division: " + a + " / " + b + " = " + divide(a, b));`
        };
    }
}

module.exports = { CraftLangCompiler };
