/**
 * CraftLang Interpreter - Executes Abstract Syntax Tree
 * Custom-built compiler component for CodeCraft IDE
 */

class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.variables = new Map();
        this.constants = new Set();
    }
    
    define(name, value, isConstant = false) {
        if (this.variables.has(name)) {
            throw new Error(`Variable '${name}' is already defined`);
        }
        this.variables.set(name, value);
        if (isConstant) {
            this.constants.add(name);
        }
    }
    
    get(name) {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        if (this.parent) {
            return this.parent.get(name);
        }
        throw new Error(`Undefined variable '${name}'`);
    }
    
    set(name, value) {
        if (this.variables.has(name)) {
            if (this.constants.has(name)) {
                throw new Error(`Cannot reassign constant '${name}'`);
            }
            this.variables.set(name, value);
            return;
        }
        if (this.parent) {
            this.parent.set(name, value);
            return;
        }
        throw new Error(`Undefined variable '${name}'`);
    }
}

class ReturnValue {
    constructor(value) {
        this.value = value;
    }
}

class CraftLangFunction {
    constructor(name, parameters, body, closure) {
        this.name = name;
        this.parameters = parameters;
        this.body = body;
        this.closure = closure;
    }
    
    call(interpreter, args) {
        if (args.length !== this.parameters.length) {
            throw new Error(`Function '${this.name}' expects ${this.parameters.length} arguments, got ${args.length}`);
        }
        
        const environment = new Environment(this.closure);
        
        // Bind parameters
        for (let i = 0; i < this.parameters.length; i++) {
            environment.define(this.parameters[i], args[i]);
        }
        
        try {
            interpreter.executeBlock(this.body.statements, environment);
        } catch (returnValue) {
            if (returnValue instanceof ReturnValue) {
                return returnValue.value;
            }
            throw returnValue;
        }
        
        return null;
    }
}

class CraftLangInterpreter {
    constructor(outputCallback, inputCallback) {
        this.globals = new Environment();
        this.environment = this.globals;
        this.outputCallback = outputCallback || console.log;
        this.inputCallback = inputCallback || (() => prompt('Input:'));
        
        // Define built-in functions
        this.defineBuiltins();
    }
    
    defineBuiltins() {
        // Built-in functions can be added here
        this.globals.define('clock', {
            call: () => Date.now() / 1000
        });
        
        this.globals.define('toString', {
            call: (interpreter, args) => {
                if (args.length !== 1) {
                    throw new Error('toString expects 1 argument');
                }
                return String(args[0]);
            }
        });
        
        this.globals.define('toNumber', {
            call: (interpreter, args) => {
                if (args.length !== 1) {
                    throw new Error('toNumber expects 1 argument');
                }
                const num = Number(args[0]);
                if (isNaN(num)) {
                    throw new Error('Cannot convert to number');
                }
                return num;
            }
        });
    }
    
    interpret(ast) {
        try {
            return this.evaluate(ast);
        } catch (error) {
            if (error instanceof ReturnValue) {
                return error.value;
            }
            throw error;
        }
    }
    
    evaluate(node) {
        switch (node.type) {
            case 'Program':
                let result = null;
                for (const statement of node.statements) {
                    result = this.evaluate(statement);
                }
                return result;
                
            case 'VariableDeclaration':
                const value = this.evaluate(node.value);
                this.environment.define(node.identifier, value, node.isConstant);
                return value;
                
            case 'FunctionDeclaration':
                const func = new CraftLangFunction(node.name, node.parameters, node.body, this.environment);
                this.environment.define(node.name, func);
                return func;
                
            case 'IfStatement':
                const condition = this.evaluate(node.condition);
                if (this.isTruthy(condition)) {
                    return this.evaluate(node.thenBranch);
                } else if (node.elseBranch) {
                    return this.evaluate(node.elseBranch);
                }
                return null;
                
            case 'WhileStatement':
                let whileResult = null;
                while (this.isTruthy(this.evaluate(node.condition))) {
                    whileResult = this.evaluate(node.body);
                }
                return whileResult;
                
            case 'ForStatement':
                let forResult = null;
                this.evaluate(node.init);
                while (this.isTruthy(this.evaluate(node.condition))) {
                    forResult = this.evaluate(node.body);
                    this.evaluate(node.update);
                }
                return forResult;
                
            case 'ReturnStatement':
                const returnValue = node.value ? this.evaluate(node.value) : null;
                throw new ReturnValue(returnValue);
                
            case 'ExpressionStatement':
                return this.evaluate(node.expression);
                
            case 'BlockStatement':
                return this.executeBlock(node.statements, new Environment(this.environment));
                
            case 'PrintStatement':
                const printValue = this.evaluate(node.expression);
                this.outputCallback(this.stringify(printValue));
                return printValue;
                
            case 'BinaryExpression':
                return this.evaluateBinaryExpression(node);
                
            case 'UnaryExpression':
                return this.evaluateUnaryExpression(node);
                
            case 'AssignmentExpression':
                const assignValue = this.evaluate(node.value);
                this.environment.set(node.identifier, assignValue);
                return assignValue;
                
            case 'CallExpression':
                return this.evaluateCallExpression(node);
                
            case 'Identifier':
                return this.environment.get(node.name);
                
            case 'Literal':
                return node.value;
                
            case 'InputExpression':
                let promptText = 'Input: ';
                if (node.prompt) {
                    promptText = this.stringify(this.evaluate(node.prompt));
                }
                const input = this.inputCallback(promptText);
                // Try to parse as number, otherwise return as string
                const numInput = Number(input);
                return isNaN(numInput) ? input : numInput;
                
            default:
                throw new Error(`Unknown AST node type: ${node.type}`);
        }
    }
    
    executeBlock(statements, environment) {
        const previous = this.environment;
        try {
            this.environment = environment;
            let result = null;
            for (const statement of statements) {
                result = this.evaluate(statement);
            }
            return result;
        } finally {
            this.environment = previous;
        }
    }
    
    evaluateBinaryExpression(node) {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        
        switch (node.operator) {
            case '+':
                if (typeof left === 'number' && typeof right === 'number') {
                    return left + right;
                }
                if (typeof left === 'string' || typeof right === 'string') {
                    return this.stringify(left) + this.stringify(right);
                }
                throw new Error('Operands must be numbers or strings');
                
            case '-':
                this.checkNumberOperands(node.operator, left, right);
                return left - right;
                
            case '*':
                this.checkNumberOperands(node.operator, left, right);
                return left * right;
                
            case '/':
                this.checkNumberOperands(node.operator, left, right);
                if (right === 0) {
                    throw new Error('Division by zero');
                }
                return left / right;
                
            case '%':
                this.checkNumberOperands(node.operator, left, right);
                return left % right;
                
            case '>':
                this.checkNumberOperands(node.operator, left, right);
                return left > right;
                
            case '>=':
                this.checkNumberOperands(node.operator, left, right);
                return left >= right;
                
            case '<':
                this.checkNumberOperands(node.operator, left, right);
                return left < right;
                
            case '<=':
                this.checkNumberOperands(node.operator, left, right);
                return left <= right;
                
            case '==':
                return this.isEqual(left, right);
                
            case '!=':
                return !this.isEqual(left, right);
                
            case 'and':
                return this.isTruthy(left) && this.isTruthy(right);
                
            case 'or':
                return this.isTruthy(left) || this.isTruthy(right);
                
            default:
                throw new Error(`Unknown binary operator: ${node.operator}`);
        }
    }
    
    evaluateUnaryExpression(node) {
        const operand = this.evaluate(node.operand);
        
        switch (node.operator) {
            case '-':
                this.checkNumberOperand(node.operator, operand);
                return -operand;
                
            case 'not':
            case '!':
                return !this.isTruthy(operand);
                
            default:
                throw new Error(`Unknown unary operator: ${node.operator}`);
        }
    }
    
    evaluateCallExpression(node) {
        const callee = this.evaluate(node.callee);
        
        if (!callee || typeof callee.call !== 'function') {
            throw new Error('Can only call functions');
        }
        
        const args = node.arguments.map(arg => this.evaluate(arg));
        
        if (callee instanceof CraftLangFunction) {
            return callee.call(this, args);
        } else {
            return callee.call(this, args);
        }
    }
    
    checkNumberOperand(operator, operand) {
        if (typeof operand !== 'number') {
            throw new Error(`Operand must be a number for operator '${operator}'`);
        }
    }
    
    checkNumberOperands(operator, left, right) {
        if (typeof left !== 'number' || typeof right !== 'number') {
            throw new Error(`Operands must be numbers for operator '${operator}'`);
        }
    }
    
    isTruthy(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.length > 0;
        return true;
    }
    
    isEqual(left, right) {
        return left === right;
    }
    
    stringify(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        return String(value);
    }
}

module.exports = {
    CraftLangInterpreter,
    Environment,
    ReturnValue,
    CraftLangFunction
};
