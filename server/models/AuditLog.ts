export interface IAuditLog {
  _id: string;
  action: string;
  actor: string;
  target: string;
  metadata: any;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

class AuditLogModel {
  private logs: IAuditLog[] = [
    {
      _id: 'audit_init',
      action: 'system_boot',
      actor: 'system',
      target: 'gateway',
      metadata: { note: 'Security subsystem initialized' },
      timestamp: new Date(),
    },
  ];

  async create(data: Partial<IAuditLog>): Promise<IAuditLog> {
    const doc: IAuditLog = {
      _id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action: data.action || 'unknown',
      actor: data.actor || 'unknown',
      target: data.target || 'unknown',
      metadata: data.metadata || {},
      ip: data.ip,
      userAgent: data.userAgent,
      timestamp: data.timestamp || new Date(),
    };
    this.logs.unshift(doc);
    return doc;
  }

  find(filter: any = {}) {
    let result = [...this.logs];
    if (filter.action) {
      result = result.filter((l) => l.action === filter.action);
    }
    const queryObj: any = {
      sort: (_s: any) => queryObj,
      limit: (n: number) => {
        result = result.slice(0, n);
        return queryObj;
      },
      lean: () => result.map((l) => ({ ...l })),
      then: (resolve: any, reject?: any) => {
        try {
          resolve(result);
        } catch (e) {
          if (reject) reject(e);
        }
      },
    };
    return queryObj;
  }
}

export const AuditLog = new AuditLogModel();
export default AuditLog;
