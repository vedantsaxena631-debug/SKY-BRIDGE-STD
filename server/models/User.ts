import bcrypt from 'bcryptjs';
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser {
  _id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'operator' | 'viewer';
  team: 'A' | 'B' | null;
  name?: string;
  callsign?: string;
  lastLoginAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDoc extends Omit<IUser, '_id'>, Document {
  _id: any;
  verifyPassword(plain: string): Promise<boolean>;
}

export const UserSchema = new Schema<IUserDoc>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'operator', 'viewer'] },
    team: { type: String, default: null, enum: ['A', 'B', null] },
    name: { type: String },
    callsign: { type: String },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MongoUserModel = mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema);

// In-memory store with persistence
class UserModel {
  private users: IUser[] = [];

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const opAPass = process.env.SEED_OPERATOR_A_PASSWORD || 'teama123';
    const opBPass = process.env.SEED_OPERATOR_B_PASSWORD || 'teamb123';
    const viewerPass = process.env.SEED_VIEWER_PASSWORD || 'viewer123';

    this.users = [
      {
        _id: 'user_admin',
        username: 'admin',
        passwordHash: bcrypt.hashSync(adminPass, 10),
        role: 'admin',
        team: null,
        name: 'Mission Commander',
        callsign: 'COMMAND-01',
        lastLoginAt: null,
        createdAt: new Date(),
      },
      {
        _id: 'user_team_a',
        username: 'team-a',
        passwordHash: bcrypt.hashSync(opAPass, 10),
        role: 'operator',
        team: 'A',
        name: 'Field Team Alpha',
        callsign: 'ALPHA-LEAD',
        lastLoginAt: null,
        createdAt: new Date(),
      },
      {
        _id: 'user_team_b',
        username: 'team-b',
        passwordHash: bcrypt.hashSync(opBPass, 10),
        role: 'operator',
        team: 'B',
        name: 'Rescue Team Bravo',
        callsign: 'BRAVO-LEAD',
        lastLoginAt: null,
        createdAt: new Date(),
      },
      {
        _id: 'user_observer',
        username: 'observer',
        passwordHash: bcrypt.hashSync(viewerPass, 10),
        role: 'viewer',
        team: null,
        name: 'HQ Observer',
        callsign: 'OBSERVER-HQ',
        lastLoginAt: null,
        createdAt: new Date(),
      },
    ];
  }

  async countDocuments(filter: any = {}): Promise<number> {
    if (mongoose.connection.readyState === 1) {
      return MongoUserModel.countDocuments(filter);
    }

    return this.users.filter((u) => {
      if (filter.passwordHash) {
        if (filter.passwordHash.$not && filter.passwordHash.$not instanceof RegExp) {
          const match = filter.passwordHash.$not.test(u.passwordHash);
          if (match) return false; // $not matches the regex, so exclude
          return true; // doesn't match the bcrypt regex, so include (defective)
        }
      }
      if (filter.username && u.username !== filter.username) return false;
      if (filter.role && u.role !== filter.role) return false;
      return true;
    }).length;
  }

  async findOne(filter: { username?: string; _id?: string }): Promise<any | null> {
    if (mongoose.connection.readyState === 1) {
      const doc = await MongoUserModel.findOne(filter as any);
      if (!doc) return null;
      (doc as any).verifyPassword = (plainPassword: string) => bcrypt.compare(plainPassword, doc.passwordHash);
      return doc;
    }

    const user = this.users.find((u) => {
      if (filter.username && u.username.toLowerCase() === filter.username.toLowerCase()) return true;
      if (filter._id && u._id === filter._id) return true;
      return false;
    });

    if (!user) return null;

    return {
      ...user,
      verifyPassword: (plainPassword: string) => bcrypt.compare(plainPassword, user.passwordHash),
      save: async () => {
        const idx = this.users.findIndex((u) => u._id === user._id);
        if (idx !== -1) {
          this.users[idx] = { ...user, updatedAt: new Date() };
        }
        return user;
      },
      toJSON: () => {
        const { passwordHash, ...rest } = user;
        return rest;
      },
    };
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    if (mongoose.connection.readyState === 1) {
      return MongoUserModel.create(data) as any;
    }

    const newUser: IUser = {
      _id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: data.username!.toLowerCase().trim(),
      passwordHash: data.passwordHash!,
      role: data.role as any,
      team: (data.team as any) || null,
      name: data.name || data.username,
      callsign: data.callsign || data.username?.toUpperCase(),
      lastLoginAt: null,
      createdAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async hashPassword(plainPassword: string) {
    return bcrypt.hash(plainPassword, 12);
  }
}

export const User = new UserModel();
export default User;
