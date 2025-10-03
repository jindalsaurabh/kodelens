// src/utils/codeExplainer.ts
import { LocalCache } from '../database';
import { HybridEmbeddingService } from '../services/HybridEmbeddingService';
import { findRelevantChunks } from '../retrieval';

// ===== INTERFACES =====

export interface CodeExplanation {
    summary: string;
    breakdown: ExplanationSection[];
    similarPatterns: SimilarPattern[];
    recommendations?: string[];
    complexity: ComplexityMetrics;
}

export interface ExplanationSection {
    title: string;
    content: string;
    icon: string;
}

export interface SimilarPattern {
    similarity: number;
    snippet: string;
    filePath: string;
    type: string;
}

interface CodeAnalysis {
    type: string;
    operations: string[];
    constructs: string[];
    salesforceSpecific: string[];
    riskLevel: 'low' | 'medium' | 'high';
    lineCount: number;
    // Enhanced properties
    variables: string[];
    methodCalls: Array<{method: string, object?: string}>;
    dataFlow: DataFlowAnalysis;
    purpose: string;
}

interface DataFlowAnalysis {
    inputs: string[];
    outputs: string[];
    transformations: Array<{target: string, expression: string}>;
}

interface ComplexityMetrics {
    level: 'simple' | 'moderate' | 'complex';
    score: number;
    factors: {
        cyclomatic: number;
        cognitive: number;
        structural: number;
        salesforce: number;
    };
    details: string[];
}


// ===== MAIN EXPORT =====

/**
 * Generate a comprehensive explanation for Apex code
 */
export async function generateCodeExplanation(
    code: string,
    cache: LocalCache,
    embeddingService: HybridEmbeddingService,
    fileName?: string
): Promise<CodeExplanation> {
    // Step 1: Enhanced code structure analysis
    const analysis = analyzeCodeStructure(code);
    
    // Step 2: Find similar patterns in codebase
    const similarChunks = await findRelevantChunks(code, cache, embeddingService, 5);
    
    // Step 3: Generate comprehensive explanation with enhanced details
    return buildCompleteExplanation(analysis, similarChunks, code, fileName);
}

// ===== ENHANCED CODE ANALYSIS =====

/**
 * Enhanced code structure analysis with specific context understanding
 */
function analyzeCodeStructure(code: string): CodeAnalysis {
    const lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const analysis: CodeAnalysis = {
        type: 'unknown',
        operations: [],
        constructs: [],
        salesforceSpecific: [],
        riskLevel: 'low',
        lineCount: lines.length,
        variables: extractVariables(code),
        methodCalls: extractMethodCalls(code),
        dataFlow: analyzeDataFlow(code),
        purpose: inferPurpose(code)
    };

    // Enhanced type detection with context
    analysis.type = detectCodeTypeWithContext(code);
    
    // Enhanced operation detection
    analysis.operations = detectSpecificOperations(code, analysis.variables);
    
    // Enhanced Salesforce context
    analysis.salesforceSpecific = detectSalesforceContext(code, analysis.methodCalls);
    
    // Enhanced risk assessment with data flow
    analysis.riskLevel = assessRiskWithContext(analysis);

    return analysis;
}

function extractVariables(code: string): string[] {
    const variables: string[] = [];
    
    // Match variable declarations and assignments
    const varPatterns = [
        /(\w+)\s*=\s*[^;]+;/g,                    // assignments: x = value;
        /(List|Set|Map)<.*>\s+(\w+)/g,            // collections: List<String> names
        /(\w+)\s+(\w+)\s*=/g,                     // declarations: String name =
        /for\s*\(\s*(\w+)\s*:/g,                  // loop variables: for (account : 
    ];
    
    varPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            // Get the variable name (different patterns capture different groups)
            const varName = match[2] || match[1];
            if (varName && !variables.includes(varName) && varName.length > 1) {
                variables.push(varName);
            }
        }
    });
    
    return variables;
}

function extractMethodCalls(code: string): Array<{method: string, object?: string}> {
    const methodCalls: Array<{method: string, object?: string}> = [];
    
    // Match method calls: object.method(), Class.method(), method()
    const methodPattern = /(?:(\w+)\.)?(\w+)\s*\([^)]*\)/g;
    let match;
    
    while ((match = methodPattern.exec(code)) !== null) {
        const object = match[1];
        const method = match[2];
        
        if (method && !['if', 'for', 'while', 'return'].includes(method)) {
            methodCalls.push({
                method: method,
                object: object
            });
        }
    }
    
    return methodCalls;
}

function analyzeDataFlow(code: string): DataFlowAnalysis {
    const lines = code.split('\n');
    const dataFlow: DataFlowAnalysis = {
        inputs: [],
        outputs: [],
        transformations: []
    };
    
    // Detect method parameters as inputs
    const paramMatch = code.match(/\(([^)]+)\)/);
    if (paramMatch) {
        const params = paramMatch[1].split(',').map(p => p.trim().split(/\s+/).pop() || '');
        dataFlow.inputs.push(...params.filter(p => p && p !== ''));
    }
    
    // Detect return values as outputs
    if (code.includes('return')) {
        const returnMatch = code.match(/return\s+(\w+)/);
        if (returnMatch) {
            dataFlow.outputs.push(returnMatch[1]);
        }
    }
    
    // Detect assignments as transformations
    const assignmentPattern = /(\w+)\s*=\s*(.+);/g;
    let assignmentMatch;
    while ((assignmentMatch = assignmentPattern.exec(code)) !== null) {
        const leftVar = assignmentMatch[1];
        const rightExpr = assignmentMatch[2];
        
        if (leftVar && rightExpr) {
            dataFlow.transformations.push({
                target: leftVar,
                expression: rightExpr.trim()
            });
        }
    }
    
    return dataFlow;
}

function inferPurpose(code: string): string {
    const lowerCode = code.toLowerCase();
    
    // Specific purpose detection based on common patterns
    if (lowerCode.includes('select') && lowerCode.includes('from')) {
        return 'data_retrieval';
    } else if (lowerCode.includes('insert') || lowerCode.includes('update') || lowerCode.includes('delete')) {
        return 'data_modification';
    } else if (lowerCode.includes('calculate') || lowerCode.includes('total') || lowerCode.includes('sum')) {
        return 'calculation';
    } else if (lowerCode.includes('validate') || lowerCode.includes('check') || lowerCode.includes('verify')) {
        return 'validation';
    } else if (lowerCode.includes('process') || lowerCode.includes('handle')) {
        return 'business_logic';
    } else if (lowerCode.includes('test') || lowerCode.includes('assert')) {
        return 'testing';
    }
    
    return 'general_processing';
}

function detectCodeTypeWithContext(code: string): string {
    if (code.match(/class\s+\w+/)) {return 'class';}
    if (code.match(/(public|private|protected)\s+(static\s+)?\w+\s+\w+\([^)]*\)\s*\{/)) {return 'method';}
    if (code.match(/trigger\s+\w+\s+on\s+\w+/)) {return 'trigger';}
    if (code.match(/@isTest/)) {return 'test_method';}
    if (code.match(/@AuraEnabled/)) {return 'aura_method';}
    if (code.match(/SELECT.*FROM.*WHERE/i)) {return 'soql_query_with_conditions';}
    if (code.match(/SELECT.*FROM/i)) {return 'soql_query';}
    
    return 'code_block';
}

function detectSpecificOperations(code: string, variables: string[]): string[] {
    const operations: string[] = [];
    
    if (code.includes('Database.')) {operations.push('database_operation');}
    if (code.includes('insert') || code.includes('update') || code.includes('delete') || code.includes('upsert')) {
        operations.push('dml_operation');
    }
    if (code.match(/try\s*{/) && code.match(/catch\s*\(/)) {operations.push('error_handling');}
    if (code.match(/for\s*\(/) || code.match(/while\s*\(/)) {operations.push('loop');}
    if (code.match(/if\s*\(/) || code.match(/else\s*/)) {operations.push('conditional');}
    if (code.includes('Future')) {operations.push('async_operation');}
    
    return operations;
}

function detectSalesforceContext(code: string, methodCalls: Array<{method: string, object?: string}>): string[] {
    const sfSpecific: string[] = [];
    
    if (code.match(/SELECT.*FROM/i)) {sfSpecific.push('soql');}
    if (code.match(/List<\w+>/)) {sfSpecific.push('collections');}
    if (code.includes('Trigger.') && (code.includes('oldMap') || code.includes('newMap'))) {
        sfSpecific.push('trigger_context');
    }
    if (code.includes('with sharing') || code.includes('without sharing')) {
        sfSpecific.push('sharing_rules');
    }
    
    return sfSpecific;
}

function assessRiskWithContext(analysis: CodeAnalysis): 'low' | 'medium' | 'high' {
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (analysis.operations.includes('soql') && analysis.operations.includes('loop')) {riskLevel = 'medium';}
    if (analysis.operations.includes('dml_operation') && analysis.operations.includes('loop')) {riskLevel = 'high';}
    if (codeIncludes(analysis, 'without sharing')) {riskLevel = 'high';}
    if (analysis.operations.includes('async_operation') && !codeIncludes(analysis, 'callout')) {riskLevel = 'medium';}
    
    return riskLevel;
}

function codeIncludes(analysis: CodeAnalysis, pattern: string): boolean {
    // Helper to check if code includes pattern (simplified)
    return analysis.dataFlow.transformations.some(t => 
        t.expression.includes(pattern) || t.target.includes(pattern)
    );
}

// ===== ENHANCED EXPLANATION GENERATION =====

function generateSpecificSummary(analysis: CodeAnalysis, code: string): string {
    const { variables, methodCalls, dataFlow, purpose } = analysis;
    
    let summary = '';
    
    // Start with purpose-based context
    switch (purpose) {
        case 'data_retrieval':
            summary = `This code **retrieves data** from Salesforce `;
            if (variables.length > 0) {
                summary += `using variables like \`${variables.slice(0, 2).join('`, `')}\``;
            }
            break;
            
        case 'data_modification':
            summary = `This code **modifies Salesforce records** `;
            if (methodCalls.length > 0) {
                summary += `through operations like \`${methodCalls[0].method}()\``;
            }
            break;
            
        case 'calculation':
            summary = `This code **performs calculations** `;
            if (dataFlow.transformations.length > 0) {
                const calc = dataFlow.transformations[0];
                summary += `such as \`${calc.target} = ${calc.expression}\``;
            }
            break;
            
        case 'validation':
            summary = `This code **validates data or conditions** `;
            break;
            
        default:
            summary = `This code **processes business logic** `;
    }
    
    // Add data flow context
    if (dataFlow.inputs.length > 0 && dataFlow.outputs.length > 0) {
        summary += `, transforming \`${dataFlow.inputs[0]}\` into \`${dataFlow.outputs[0]}\``;
    }
    
    // Add method call context
    if (methodCalls.length > 0) {
        const mainCall = methodCalls[0];
        if (mainCall.object) {
            summary += ` by calling \`${mainCall.object}.${mainCall.method}()\``;
        } else {
            summary += ` using \`${mainCall.method}()\``;
        }
    }
    
    return summary + '.';
}

function generateDetailedBreakdown(analysis: CodeAnalysis, code: string): ExplanationSection[] {
    const sections: ExplanationSection[] = [];
    const { variables, methodCalls, dataFlow, purpose } = analysis;

    // Data Flow Section
    if (dataFlow.inputs.length > 0 || dataFlow.outputs.length > 0) {
        let flowContent = '';
        if (dataFlow.inputs.length > 0) {
            flowContent += `**Inputs:** \`${dataFlow.inputs.join('`, `')}\`\n\n`;
        }
        if (dataFlow.outputs.length > 0) {
            flowContent += `**Outputs:** \`${dataFlow.outputs.join('`, `')}\`\n\n`;
        }
        if (dataFlow.transformations.length > 0) {
            flowContent += `**Transformations:**\n`;
            dataFlow.transformations.forEach(transform => {
                flowContent += `• \`${transform.target}\` = ${transform.expression}\n`;
            });
        }
        
        sections.push({
            title: 'Data Flow',
            content: flowContent,
            icon: '🔄'
        });
    }

    // Variables & Usage Section
    if (variables.length > 0) {
        sections.push({
            title: 'Variables & Usage',
            content: `**Variables used:** \`${variables.join('`, `')}\``,
            icon: '📊'
        });
    }

    // Method Interactions Section
    if (methodCalls.length > 0) {
        const methodContent = methodCalls.map(call => {
            if (call.object) {
                return `• \`${call.object}.${call.method}()\``;
            } else {
                return `• \`${call.method}()\``;
            }
        }).join('\n');
        
        sections.push({
            title: 'Method Calls',
            content: methodContent,
            icon: '📞'
        });
    }

    // Purpose & Context Section
    sections.push({
        title: 'Purpose',
        content: getPurposeDescription(purpose),
        icon: '🎯'
    });

    // Add original breakdown sections for compatibility
    sections.push({
        title: 'Code Type',
        content: getTypeDescription(analysis.type),
        icon: '📝'
    });

    if (analysis.operations.length > 0) {
        sections.push({
            title: 'Key Operations',
            content: analysis.operations.map(op => `• ${getOperationDescription(op)}`).join('\n'),
            icon: '⚡'
        });
    }

    if (analysis.salesforceSpecific.length > 0) {
        sections.push({
            title: 'Salesforce Patterns',
            content: analysis.salesforceSpecific.map(sf => `• ${getSalesforceDescription(sf)}`).join('\n'),
            icon: '🏢'
        });
    }

    sections.push({
        title: 'Risk Assessment',
        content: getRiskDescription(analysis.riskLevel),
        icon: analysis.riskLevel === 'high' ? '⚠️' : (analysis.riskLevel === 'medium' ? '🔸' : '✅')
    });

    return sections;
}

// ===== EXPLANATION BUILDING =====

/**
 * Build complete explanation from analysis and similar patterns
 */
function buildCompleteExplanation(
    analysis: CodeAnalysis, 
    similarChunks: any[], 
    originalCode: string,
    fileName?: string
): CodeExplanation {
    const explanation: CodeExplanation = {
        summary: generateSpecificSummary(analysis, originalCode),
        breakdown: generateDetailedBreakdown(analysis, originalCode),
        similarPatterns: mapSimilarPatterns(similarChunks),
        complexity: assessComplexity(analysis, originalCode),
        recommendations: generateContextualRecommendations(analysis, originalCode)
    };

    return explanation;
}

function mapSimilarPatterns(similarChunks: any[]): SimilarPattern[] {
    return similarChunks.slice(0, 3).map(chunk => ({
        similarity: chunk.score || 0.5,
        snippet: chunk.chunk.text?.substring(0, 150) + '...' || 'No content available',
        filePath: chunk.chunk.filePath || 'Unknown file',
        type: chunk.chunk.type || 'unknown'
    }));
}

/*
function assessComplexity(analysis: CodeAnalysis): 'simple' | 'moderate' | 'complex' {
    if (analysis.lineCount > 50 || analysis.operations.length > 4) {return 'complex';}
    if (analysis.lineCount > 20 || analysis.operations.length > 2) {return 'moderate';}
    return 'simple';
} */

/**
 * Enhanced complexity analysis with multiple metrics
 */
function assessComplexity(analysis: CodeAnalysis, code: string): ComplexityMetrics {
    let score = 0;
    const details: string[] = [];
    
    // 1. CYCLOMATIC COMPLEXITY (Control Flow)
    const cyclomaticScore = calculateCyclomaticComplexity(code);
    score += cyclomaticScore.weight;
    details.push(...cyclomaticScore.details);
    
    // 2. COGNITIVE COMPLEXITY (Readability)
    const cognitiveScore = calculateCognitiveComplexity(code, analysis);
    score += cognitiveScore.weight;
    details.push(...cognitiveScore.details);
    
    // 3. STRUCTURAL COMPLEXITY (Size & Structure)
    const structuralScore = calculateStructuralComplexity(analysis, code);
    score += structuralScore.weight;
    details.push(...structuralScore.details);
    
    // 4. SALESFORCE-SPECIFIC COMPLEXITY
    const salesforceScore = calculateSalesforceComplexity(analysis, code);
    score += salesforceScore.weight;
    details.push(...salesforceScore.details);
    
    // Determine final level
    let level: 'simple' | 'moderate' | 'complex';
    if (score >= 12) {
        level = 'complex';
    } else if (score >= 6) {
        level = 'moderate';
    } else {
        level = 'simple';
    }
    
    return {
        level,
        score,
        factors: {
            cyclomatic: cyclomaticScore.weight,
            cognitive: cognitiveScore.weight,
            structural: structuralScore.weight,
            salesforce: salesforceScore.weight
        },
        details: details.slice(0, 3) // Show top 3 factors
    };
}

/**
 * Calculate cyclomatic complexity based on control flow paths
 */
function calculateCyclomaticComplexity(code: string): { weight: number; details: string[] } {
    let weight = 0;
    const details: string[] = [];
    
    // Count decision points
    const ifStatements = (code.match(/if\s*\(/g) || []).length;
    const forLoops = (code.match(/for\s*\(/g) || []).length;
    const whileLoops = (code.match(/while\s*\(/g) || []).length;
    const switchCases = (code.match(/switch\s*\(/g) || []).length;
    const catchBlocks = (code.match(/catch\s*\(/g) || []).length;
    const ternaryOps = (code.match(/\?.*:/g) || []).length;
    
    // Cyclomatic complexity = decisions + 1
    const decisions = ifStatements + forLoops + whileLoops + switchCases + catchBlocks + ternaryOps;
    
    if (decisions === 0) {
        weight = 1;
    } else if (decisions <= 2) {
        weight = 2;
        details.push(`${decisions} decision point${decisions > 1 ? 's' : ''}`);
    } else if (decisions <= 5) {
        weight = 3;
        details.push(`${decisions} decision points`);
    } else {
        weight = 4;
        details.push(`High control flow (${decisions} decisions)`);
    }
    
    return { weight, details };
}

/**
 * Calculate cognitive complexity (nested structures, method calls)
 */
function calculateCognitiveComplexity(code: string, analysis: CodeAnalysis): { weight: number; details: string[] } {
    let weight = 0;
    const details: string[] = [];
    
    // Nesting depth
    const maxNesting = calculateNestingDepth(code);
    if (maxNesting > 3) {
        weight += 3;
        details.push(`Deep nesting (${maxNesting} levels)`);
    } else if (maxNesting > 1) {
        weight += 2;
        details.push(`Moderate nesting (${maxNesting} levels)`);
    } else {
        weight += 1;
    }
    
    // Method calls and external dependencies
    const methodCalls = analysis.methodCalls.length;
    if (methodCalls > 5) {
        weight += 3;
        details.push(`Many method calls (${methodCalls})`);
    } else if (methodCalls > 2) {
        weight += 2;
        details.push(`Several method calls (${methodCalls})`);
    } else {
        weight += 1;
    }
    
    return { weight, details };
}

/**
 * Calculate structural complexity (size, variables, operations)
 */
function calculateStructuralComplexity(analysis: CodeAnalysis, code: string): { weight: number; details: string[] } {
    let weight = 0;
    const details: string[] = [];
    
    // Size-based complexity
    if (analysis.lineCount > 50) {
        weight += 3;
        details.push(`Long method (${analysis.lineCount} lines)`);
    } else if (analysis.lineCount > 25) {
        weight += 2;
        details.push(`Medium length (${analysis.lineCount} lines)`);
    } else {
        weight += 1;
    }
    
    // Operations complexity
    const operationsCount = analysis.operations.length;
    if (operationsCount > 4) {
        weight += 3;
        details.push(`Multiple operations (${operationsCount})`);
    } else if (operationsCount > 2) {
        weight += 2;
        details.push(`Several operations (${operationsCount})`);
    } else {
        weight += 1;
    }
    
    // Variable complexity
    const variablesCount = analysis.variables.length;
    if (variablesCount > 8) {
        weight += 2;
        details.push(`Many variables (${variablesCount})`);
    } else if (variablesCount > 4) {
        weight += 1;
    }
    
    return { weight, details };
}

/**
 * Calculate Salesforce-specific complexity factors
 */
function calculateSalesforceComplexity(analysis: CodeAnalysis, code: string): { weight: number; details: string[] } {
    let weight = 0;
    const details: string[] = [];
    
    // SOQL in loops (governor limit risk)
    if (code.includes('SELECT') && (code.includes('for(') || code.includes('for ('))) {
        weight += 3;
        details.push('SOQL query in loop (governor limit risk)');
    }
    
    // DML in loops
    if ((code.includes('insert') || code.includes('update') || code.includes('delete')) && 
        (code.includes('for(') || code.includes('for ('))) {
        weight += 3;
        details.push('DML operation in loop');
    }
    
    // Complex SOQL
    const soqlMatches = code.match(/SELECT.*FROM.*WHERE.*/gi) || [];
    if (soqlMatches.length > 0) {
        weight += 1;
        if (soqlMatches.some(soql => soql.includes('LIKE') || soql.includes('IN:'))) {
            weight += 1;
            details.push('Complex SOQL with dynamic queries');
        }
    }
    
    // Trigger context complexity
    if (analysis.salesforceSpecific.includes('trigger_context')) {
        weight += 2;
        details.push('Trigger context processing');
    }
    
    // Async operations
    if (analysis.operations.includes('async_operation')) {
        weight += 2;
        details.push('Asynchronous processing');
    }
    
    return { weight, details };
}

/**
 * Calculate maximum nesting depth in code
 */
function calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (let i = 0; i < code.length; i++) {
        if (code[i] === '{') {
            currentDepth++;
            maxDepth = Math.max(maxDepth, currentDepth);
        } else if (code[i] === '}') {
            currentDepth--;
        }
    }
    
    return maxDepth;
}
     
function generateContextualRecommendations(analysis: CodeAnalysis, code: string): string[] {
    const recommendations: string[] = [];

    if (analysis.riskLevel === 'high') {
        recommendations.push('Consider adding proper error handling and governor limit checks');
    }

    if (analysis.type.includes('soql_query') && !code.includes(' LIMIT ')) {
        recommendations.push('Add LIMIT clause to SOQL queries to prevent governor limit issues');
    }

    if (analysis.operations.includes('dml_operation') && !analysis.operations.includes('error_handling')) {
        recommendations.push('Wrap DML operations in try-catch blocks for better error handling');
    }

    if (analysis.dataFlow.transformations.length > 5) {
        recommendations.push('Consider breaking down complex transformations into smaller, focused methods');
    }

    return recommendations.slice(0, 3);
}

// ===== HELPER FUNCTIONS =====

function getPurposeDescription(purpose: string): string {
    const descriptions: {[key: string]: string} = {
        'data_retrieval': 'Retrieves records from the Salesforce database using SOQL queries',
        'data_modification': 'Creates, updates, or deletes records in the Salesforce database',
        'calculation': 'Performs mathematical operations or business calculations',
        'validation': 'Checks data integrity, business rules, or input validation',
        'business_logic': 'Implements core business processes and rules',
        'testing': 'Verifies that other code works as expected',
        'general_processing': 'Processes data and implements business logic'
    };
    return descriptions[purpose] || 'Processes data and implements business logic';
}

function getTypeDescription(type: string): string {
    const descriptions: {[key: string]: string} = {
        'class': 'Defines a blueprint for creating objects in Apex. Contains methods, properties, and constructors that define the behavior and state of objects.',
        'method': 'A reusable block of code that performs a specific task. Can accept parameters, return values, and be called from other parts of your code.',
        'trigger': 'Automatically executes before or after specific data manipulation events (insert, update, delete, etc.) on Salesforce records.',
        'soql_query': 'Salesforce Object Query Language (SOQL) - used to read records from the database. Similar to SQL but optimized for Salesforce data model.',
        'soql_query_with_conditions': 'SOQL query with WHERE clause - filters records based on specific conditions.',
        'test_method': 'Special method annotated with @isTest for validating your code works as expected. Required for deployment to production.',
        'aura_method': 'Exposed to Lightning Web Components or Aura components for client-side interaction. Allows frontend to call Apex logic.',
        'code_block': 'A segment of Apex code that performs specific operations within the Salesforce platform.'
    };
    return descriptions[type] || 'A segment of Apex code that performs specific operations within the Salesforce platform.';
}

function getOperationDescription(operation: string): string {
    const descriptions: {[key: string]: string} = {
        'database_operation': 'Interacts with Salesforce database using Database methods (insert, update, delete, etc.) with configurable options',
        'dml_operation': 'Modifies records in the database (insert, update, delete, upsert, undelete)',
        'error_handling': 'Uses try-catch blocks to gracefully handle exceptions and prevent code failures',
        'loop': 'Iterates over collections or executes code repeatedly using for/while loops',
        'conditional': 'Makes decisions and executes different code paths based on conditions using if/else statements',
        'async_operation': 'Runs code asynchronously using @future or Queueable Apex for long-running operations'
    };
    return descriptions[operation] || operation;
}

function getSalesforceDescription(sf: string): string {
    const descriptions: {[key: string]: string} = {
        'soql': 'Queries Salesforce database records using SOQL (Salesforce Object Query Language)',
        'collections': 'Uses Apex collections (List, Set, Map) to work with groups of records efficiently',
        'trigger_context': 'Accesses trigger context variables (Trigger.new, Trigger.oldMap) for record-based logic',
        'sharing_rules': 'Controls record access using with/without sharing keywords for data security'
    };
    return descriptions[sf] || sf;
}

function getRiskDescription(riskLevel: string): string {
    const descriptions: {[key: string]: string} = {
        'low': 'This code follows best practices and has minimal risk of governor limit issues or errors.',
        'medium': 'This code may have moderate risk. Consider adding additional error handling and governor limit checks.',
        'high': 'This code has potential risks. Review for governor limits, error handling, and security considerations.'
    };
    return descriptions[riskLevel] || 'Risk level could not be determined.';
}