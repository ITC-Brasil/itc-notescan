export declare function runMigrations(): Promise<void>;
export declare function seedDatabase(): Promise<void>;
export declare function truncateDatabase(): Promise<void>;
export declare function resetUserPassword(
  email: string,
  password: string,
): Promise<void>;
