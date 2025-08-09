/**
 * CraftLang Parser - Builds Abstract Syntax Tree from tokens
 * Custom-built compiler component for CodeCraft IDE
 */

const { TokenType } = require('./lexer');

// AST Node Types
class ASTNode {
    constructor(type) {
        this.type = type;
    }
}

class Program extends ASTNode {
    constructor(statements) {
        super('Program');
        this.statements = statements;
    }
}

class VariableDeclaration extends ASTNode {
    constructor(identifier, value, isConstant = false) {
        super('VariableDeclaration');
        this.identifier = identifier;
        this.value = value;
        this.isConstant = isConstant;
    }
}

class FunctionDeclaration extends ASTNode {
    constructor(name, parameters, body) {
        super('FunctionDeclaration');
        this.name = name;
        this.parameters = parameters;
        this.body = body;
    }
}

class IfStatement extends ASTNode {
    constructor(condition, thenBranch, elseBranch = null) {
        super('IfStatement');
        this.condition = condition;
        this.thenBranch = thenBranch;
        this.elseBranch = elseBranch;
    }
}

class WhileStatement extends ASTNode {
    constructor(condition, body) {
        super('WhileStatement');
        this.condition = condition;
        this.body = body;
    }
}

class ForStatement extends ASTNode {
    constructor(init, condition, update, body) {
        super('ForStatement');
        this.init = init;
        this.condition = condition;
        this.update = update;
        this.body = body;
    }
}

class ReturnStatement extends ASTNode {
    constructor(value = null) {
        super('ReturnStatement');
        this.value = value;
    }
}

class ExpressionStatement extends ASTNode {
    constructor(expression) {
        super('ExpressionStatement');
        this.expression = expression;
    }
}

class BlockStatement extends ASTNode {
    constructor(statements) {
        super('BlockStatement');
        this.statements = statements;
    }
}

class BinaryExpression extends ASTNode {
    constructor(left, operator, right) {
        super('BinaryExpression');
        this.left = left;
        this.operator = operator;
        this.right = right;
    }
}

class UnaryExpression extends ASTNode {
    constructor(operator, operand) {
        super('UnaryExpression');
        this.operator = operator;
        this.operand = operand;
    }
}

class AssignmentExpression extends ASTNode {
    constructor(identifier, value) {
        super('AssignmentExpression');
        this.identifier = identifier;
        this.value = value;
    }
}

class CallExpression extends ASTNode {
    constructor(callee, args) {
        super('CallExpression');
        this.callee = callee;
        this.arguments = args;
    }
}

class Identifier extends ASTNode {
    constructor(name) {
        super('Identifier');
        this.name = name;
    }
}

class Literal extends ASTNode {
    constructor(value, dataType) {
        super('Literal');
        this.value = value;
        this.dataType = dataType;
    }
}

class PrintStatement extends ASTNode {
    constructor(expression) {
        super('PrintStatement');
        this.expression = expression;
    }
}

class InputExpression extends ASTNode {
    constructor(prompt = null) {
        super('InputExpression');
        this.prompt = prompt;
    }
}

class CraftLangParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
        this.currentToken = this.tokens[this.position];
    }
    
    advance() {
        this.position++;
        if (this.position < this.tokens.length) {
            this.currentToken = this.tokens[this.position];
        } else {
            this.currentToken = null;
        }
    }
    
    peek() {
        const peekPos = this.position + 1;
        if (peekPos < this.tokens.length) {
            return this.tokens[peekPos];
        }
        return null;
    }
    
    expect(tokenType) {
        if (!this.currentToken || this.currentToken.type !== tokenType) {
            throw new Error(`Expected ${tokenType}, got ${this.currentToken ? this.currentToken.type : 'EOF'} at line ${this.currentToken ? this.currentToken.line : 'end'}`);
        }
        const token = this.currentToken;
        this.advance();
        return token;
    }
    
    match(...tokenTypes) {
        if (!this.currentToken) return false;
        return tokenTypes.includes(this.currentToken.type);
    }
    
    parse() {
        const statements = [];
        
        while (this.currentToken && this.currentToken.type !== TokenType.EOF) {
            const stmt = this.parseStatement();
            if (stmt) {
                statements.push(stmt);
            }
        }
        
        return new Program(statements);
    }
    
    parseStatement() {
        if (!this.currentToken) return null;
        
        switch (this.currentToken.type) {
            case TokenType.LET:
            case TokenType.CONST:
                return this.parseVariableDeclaration();
            case TokenType.FUNCTION:
                return this.parseFunctionDeclaration();
            case TokenType.IF:
                return this.parseIfStatement();
            case TokenType.WHILE:
                return this.parseWhileStatement();
            case TokenType.FOR:
                return this.parseForStatement();
            case TokenType.RETURN:
                return this.parseReturnStatement();
            case TokenType.LEFT_BRACE:
                return this.parseBlockStatement();
            case TokenType.PRINT:
                return this.parsePrintStatement();
            default:
                return this.parseExpressionStatement();
        }
    }
    
    parseVariableDeclaration() {
        const isConstant = this.currentToken.type === TokenType.CONST;
        this.advance(); // skip 'let' or 'const'
        
        const identifier = this.expect(TokenType.IDENTIFIER).value;
        this.expect(TokenType.ASSIGN);
        const value = this.parseExpression();
        this.expect(TokenType.SEMICOLON);
        
        return new VariableDeclaration(identifier, value, isConstant);
    }
    
    parseFunctionDeclaration() {
        this.advance(); // skip 'function'
        const name = this.expect(TokenType.IDENTIFIER).value;
        
        this.expect(TokenType.LEFT_PAREN);
        const parameters = [];
        
        while (this.currentToken && this.currentToken.type !== TokenType.RIGHT_PAREN) {
            parameters.push(this.expect(TokenType.IDENTIFIER).value);
            if (this.currentToken && this.currentToken.type === TokenType.COMMA) {
                this.advance();
            }
        }
        
        this.expect(TokenType.RIGHT_PAREN);
        const body = this.parseBlockStatement();
        
        return new FunctionDeclaration(name, parameters, body);
    }
    
    parseIfStatement() {
        this.advance(); // skip 'if'
        this.expect(TokenType.LEFT_PAREN);
        const condition = this.parseExpression();
        this.expect(TokenType.RIGHT_PAREN);
        
        const thenBranch = this.parseStatement();
        let elseBranch = null;
        
        if (this.currentToken && this.currentToken.type === TokenType.ELSE) {
            this.advance();
            elseBranch = this.parseStatement();
        }
        
        return new IfStatement(condition, thenBranch, elseBranch);
    }
    
    parseWhileStatement() {
        this.advance(); // skip 'while'
        this.expect(TokenType.LEFT_PAREN);
        const condition = this.parseExpression();
        this.expect(TokenType.RIGHT_PAREN);
        const body = this.parseStatement();
        
        return new WhileStatement(condition, body);
    }
    
    parseForStatement() {
        this.advance(); // skip 'for'
        this.expect(TokenType.LEFT_PAREN);
        
        const init = this.parseStatement();
        const condition = this.parseExpression();
        this.expect(TokenType.SEMICOLON);
        const update = this.parseExpression();
        
        this.expect(TokenType.RIGHT_PAREN);
        const body = this.parseStatement();
        
        return new ForStatement(init, condition, update, body);
    }
    
    parseReturnStatement() {
        this.advance(); // skip 'return'
        let value = null;
        
        if (this.currentToken && this.currentToken.type !== TokenType.SEMICOLON) {
            value = this.parseExpression();
        }
        
        this.expect(TokenType.SEMICOLON);
        return new ReturnStatement(value);
    }
    
    parseBlockStatement() {
        this.expect(TokenType.LEFT_BRACE);
        const statements = [];
        
        while (this.currentToken && this.currentToken.type !== TokenType.RIGHT_BRACE) {
            const stmt = this.parseStatement();
            if (stmt) {
                statements.push(stmt);
            }
        }
        
        this.expect(TokenType.RIGHT_BRACE);
        return new BlockStatement(statements);
    }
    
    parsePrintStatement() {
        this.advance(); // skip 'print'
        this.expect(TokenType.LEFT_PAREN);
        const expression = this.parseExpression();
        this.expect(TokenType.RIGHT_PAREN);
        this.expect(TokenType.SEMICOLON);
        
        return new PrintStatement(expression);
    }
    
    parseExpressionStatement() {
        const expression = this.parseExpression();
        this.expect(TokenType.SEMICOLON);
        return new ExpressionStatement(expression);
    }
    
    parseExpression() {
        return this.parseAssignment();
    }
    
    parseAssignment() {
        const expr = this.parseLogicalOr();
        
        if (this.currentToken && this.currentToken.type === TokenType.ASSIGN) {
            if (expr.type !== 'Identifier') {
                throw new Error('Invalid assignment target');
            }
            this.advance();
            const value = this.parseAssignment();
            return new AssignmentExpression(expr.name, value);
        }
        
        return expr;
    }
    
    parseLogicalOr() {
        let expr = this.parseLogicalAnd();
        
        while (this.currentToken && this.currentToken.type === TokenType.OR) {
            const operator = this.currentToken.value;
            this.advance();
            const right = this.parseLogicalAnd();
            expr = new BinaryExpression(expr, operator, right);
        }
        
        return expr;
    }
    
    parseLogicalAnd() {
        let expr = this.parseEquality();
        
        while (this.currentToken && this.currentToken.type === TokenType.AND) {
            const operator = this.currentToken.value;
            this.advance();
            const right = this.parseEquality();
            expr = new BinaryExpression(expr, operator, right);
        }
        
        return expr;
    }
    
    parseEquality() {
        let expr = this.parseComparison();
        
        while (this.currentToken && this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
            const operator = this.currentToken.value;
            this.advance();
            const right = this.parseComparison();
            expr = new BinaryExpression(expr, operator, right);
        }
        
        return expr;
    }
    
    parseComparison() {
        let expr = this.parseAddition();
        
        while (this.currentToken && this.match(TokenType.GREATER_THAN, TokenType.GREATER_EQUAL, 
                                                TokenType.LESS_THAN, TokenType.LESS_EQUAL)) {
            const operator = this.currentToken.value;
            this.advance();
            const right = this.parseAddition();
            expr = new BinaryExpression(expr, operator, right);
        }
        
        return expr;
    }
    
    parseAddition() {
        let expr = this.parseMultiplication();
        
        while (this.currentToken && this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.currentToken.value;
            this.advance();
            const right = this.parseMultiplication();
            expr = new BinaryExpression(expr, operator, right);
        }
        
        return expr;
    }
    
    parseMultiplication() {
        let expr = this.parseUnary();
        
        while (this.currentToken && this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO)) {
            const operator = this.currentToken.value;
            this.advance();
            const right = this.parseUnary();
            expr = new BinaryExpression(expr, operator, right);
        }
        
        return expr;
    }
    
    parseUnary() {
        if (this.currentToken && this.match(TokenType.NOT, TokenType.MINUS)) {
            const operator = this.currentToken.value;
            this.advance();
            const operand = this.parseUnary();
            return new UnaryExpression(operator, operand);
        }
        
        return this.parseCall();
    }
    
    parseCall() {
        let expr = this.parsePrimary();
        
        while (this.currentToken && this.currentToken.type === TokenType.LEFT_PAREN) {
            this.advance();
            const args = [];
            
            while (this.currentToken && this.currentToken.type !== TokenType.RIGHT_PAREN) {
                args.push(this.parseExpression());
                if (this.currentToken && this.currentToken.type === TokenType.COMMA) {
                    this.advance();
                }
            }
            
            this.expect(TokenType.RIGHT_PAREN);
            expr = new CallExpression(expr, args);
        }
        
        return expr;
    }
    
    parsePrimary() {
        if (!this.currentToken) {
            throw new Error('Unexpected end of input');
        }
        
        switch (this.currentToken.type) {
            case TokenType.NUMBER:
                const numValue = this.currentToken.value;
                this.advance();
                return new Literal(numValue, 'number');
                
            case TokenType.STRING:
                const strValue = this.currentToken.value;
                this.advance();
                return new Literal(strValue, 'string');
                
            case TokenType.TRUE:
                this.advance();
                return new Literal(true, 'boolean');
                
            case TokenType.FALSE:
                this.advance();
                return new Literal(false, 'boolean');
                
            case TokenType.NULL:
                this.advance();
                return new Literal(null, 'null');
                
            case TokenType.IDENTIFIER:
                const name = this.currentToken.value;
                this.advance();
                return new Identifier(name);
                
            case TokenType.INPUT:
                this.advance();
                this.expect(TokenType.LEFT_PAREN);
                let prompt = null;
                if (this.currentToken.type !== TokenType.RIGHT_PAREN) {
                    prompt = this.parseExpression();
                }
                this.expect(TokenType.RIGHT_PAREN);
                return new InputExpression(prompt);
                
            case TokenType.LEFT_PAREN:
                this.advance();
                const expr = this.parseExpression();
                this.expect(TokenType.RIGHT_PAREN);
                return expr;
                
            default:
                throw new Error(`Unexpected token: ${this.currentToken.type} at line ${this.currentToken.line}`);
        }
    }
}

module.exports = {
    CraftLangParser,
    Program,
    VariableDeclaration,
    FunctionDeclaration,
    IfStatement,
    WhileStatement,
    ForStatement,
    ReturnStatement,
    ExpressionStatement,
    BlockStatement,
    BinaryExpression,
    UnaryExpression,
    AssignmentExpression,
    CallExpression,
    Identifier,
    Literal,
    PrintStatement,
    InputExpression
};
