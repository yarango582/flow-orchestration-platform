#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { program } = require('commander')

program
  .name('node-core-cli')
  .description('CLI tool for creating new nodes in the Flow Platform')
  .version('1.0.0')

program
  .command('create-node')
  .description('Create a new node from template')
  .option('-n, --name <name>', 'Node name (kebab-case)')
  .option('-c, --category <category>', 'Node category', 'transformation')
  .option('-o, --output <dir>', 'Output directory', './src/nodes')
  .action((options) => {
    const { name, category, output } = options
    
    if (!name) {
      console.error('Error: Node name is required')
      process.exit(1)
    }
    
    const className = name.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('') + 'Node'
    
    const template = generateNodeTemplate(name, className, category)
    const categoryDir = path.join(output, category)
    const filePath = path.join(categoryDir, `${name}.node.ts`)
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true })
    }
    
    // Write the node file
    fs.writeFileSync(filePath, template)
    
    console.log(`✅ Node created successfully!`)
    console.log(`📄 File: ${filePath}`)
    console.log(`🔧 Don't forget to:`)
    console.log(`   1. Update nodes/index.ts to export your new node`)
    console.log(`   2. Add compatibility rules in validators/compatibility-validator.ts`)
    console.log(`   3. Register the node in your application`)
  })

function generateNodeTemplate(nodeName, className, category) {
  return `import { BaseNode } from '../../base/base-node'
import { NodeResult } from '../../interfaces/node.interface'

interface ${className}Input {
  // Define your input schema here
  data: any
}

interface ${className}Output {
  // Define your output schema here
  result: any
}

interface ${className}Config {
  // Define your configuration schema here
  timeout?: number
}

export class ${className} extends BaseNode<${className}Input, ${className}Output, ${className}Config> {
  readonly type = '${nodeName}'
  readonly version = '1.0.0'
  readonly category = '${category}'
  
  async execute(input: ${className}Input): Promise<NodeResult<${className}Output>> {
    const startTime = Date.now()
    
    try {
      // TODO: Implement your node logic here
      const result = this.processData(input.data)
      
      const executionTime = Date.now() - startTime
      
      return {
        success: true,
        data: {
          result: result
        },
        metrics: {
          executionTime,
          recordsProcessed: Array.isArray(result) ? result.length : 1
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  private processData(data: any): any {
    // TODO: Implement your data processing logic
    return data
  }
  
  validate(input: ${className}Input): boolean {
    return super.validate(input) && 
           input.data !== null && 
           input.data !== undefined
  }
}
`
}

program.parse()