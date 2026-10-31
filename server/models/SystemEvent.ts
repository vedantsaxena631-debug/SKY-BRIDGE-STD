export interface ISystemEvent {
  _id: string;
  type: string;
  message: string;
  isDemo: boolean;
  sourceNode?: string;
  timestamp: Date;
}

class SystemEventModel {
  private events: ISystemEvent[] = [
    {
      _id: 'evt_1',
      type: 'INFO',
      message: 'System initialization complete. Airborne repeater armed.',
      isDemo: true,
      sourceNode: 'DRONE',
      timestamp: new Date(Date.now() - 600000),
    },
  ];

  async create(data: Partial<ISystemEvent>): Promise<ISystemEvent> {
    const doc: ISystemEvent = {
      _id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: data.type || 'INFO',
      message: data.message || '',
      isDemo: Boolean(data.isDemo),
      sourceNode: data.sourceNode,
      timestamp: data.timestamp || new Date(),
    };
    this.events.unshift(doc);
    return doc;
  }

  find(filter: any = {}) {
    let result = this.events.filter((e) => {
      if (filter.isDemo !== undefined && e.isDemo !== filter.isDemo) return false;
      return true;
    });

    const queryObj: any = {
      sort: (_s: any) => queryObj,
      limit: (n: number) => {
        result = result.slice(0, n);
        return queryObj;
      },
      lean: () => result.map((e) => ({ ...e })),
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

export const SystemEvent = new SystemEventModel();
export default SystemEvent;
