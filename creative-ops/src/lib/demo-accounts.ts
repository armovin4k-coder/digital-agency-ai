import type { Role } from "@prisma/client";

/** Display metadata for the one-click demo cards. Never use these accounts for real data. */
export const demoAccounts: Array<{
  id: string;
  name: string;
  email: string;
  role: Role;
}> = [
  { id: "buyer1", name: "Анна Смирнова", email: "buyer.anna@creativeops.demo", role: "BUYER" },
  { id: "buyer2", name: "Максим Орлов", email: "buyer.maxim@creativeops.demo", role: "BUYER" },
  { id: "creative1", name: "Алексей Волков", email: "creative.alexey@creativeops.demo", role: "CREATIVE" },
  { id: "creative2", name: "Мария Белова", email: "creative.maria@creativeops.demo", role: "CREATIVE" },
  { id: "creative3", name: "Дмитрий Соколов", email: "creative.dmitry@creativeops.demo", role: "CREATIVE" },
  { id: "manager", name: "Елена Павлова", email: "manager.elena@creativeops.demo", role: "MANAGER" },
];
