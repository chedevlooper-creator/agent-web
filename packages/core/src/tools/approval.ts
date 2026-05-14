/**
 * Security approval system for tool execution.
 * Detects dangerous commands and provides callback system for user approval.
 */

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
  requiresUserApproval: boolean;
}

// Enhanced dangerous command patterns
const DANGEROUS_COMMANDS = [
  // Filesystem destruction
  /rm\s+-rf?\s+(\/|~\/|\.\/\.)/i,
  /rmdir\s+\/s\s+\/q/i,
  /del\s+\/q\s+\/s/i,
  /shred\s+/i,
  /format\s+/i,
  /mkfs/i,

  // Git destructive
  /git\s+push\s+--force/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
  /git\s+filter-branch/i,

  // Code injection/execution
  /eval\s*\(/i,
  /curl\s+.*\s*\|/i,
  /wget\s+.*\s*\|/i,
  /bash\s+-c\s+['"].*rm\s+-rf/i,
  /sh\s+-c\s+['"].*rm\s+-rf/i,

  // Shellshock
  /:\s*\(\s*\)\s*{\s*:\s*\|/i,

  // Disk operations
  /dd\s+if=/i,
  />\s*\/dev\/sda/i,
  />\s*\/dev\/null\s+&&\s+>/i,
  /diskpart/i,
  /fsutil\s/i,

  // Privilege escalation
  /sudo\s/i,
  /\bsu\s+-/i,
  /powershell\s+(-encodedcommand|-ep\s+bypass|-nop)/i,
  /cmd\.exe\s+\/c/i,

  // Network exfiltration
  /curl\s+.*-d\s+.*http/i,
  /wget\s+.*--post/i,
  /nc\s+-e/i,
  /ncat\s+.*-e/i,

  // Hidden commands
  /\bnohup\s/i,
  /&\s*disown/i,
];

// Per-tool approval requirements
const APPROVAL_REQUIRED_TOOLS = new Set([
  "terminal",
  "execute_code",
  "write_file",
]);

export function checkCommandApproval(command: string): ApprovalResult {
  for (const pattern of DANGEROUS_COMMANDS) {
    if (pattern.test(command)) {
      return {
        approved: false,
        reason: `Command blocked by security rule: ${command}`,
        requiresUserApproval: false,
      };
    }
  }

  return { approved: true, requiresUserApproval: false };
}

export function requiresToolApproval(toolName: string): boolean {
  return APPROVAL_REQUIRED_TOOLS.has(toolName);
}

// User callback type for approval requests
export type ApprovalCallback = (toolName: string, args: Record<string, unknown>) => Promise<boolean>;

let approvalCallback: ApprovalCallback | null = null;

export function setApprovalCallback(callback: ApprovalCallback): void {
  approvalCallback = callback;
}

export async function requestUserApproval(toolName: string, args: Record<string, unknown>): Promise<boolean> {
  if (!approvalCallback) return true;
  return approvalCallback(toolName, args);
}
