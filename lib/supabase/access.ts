export const permissionOptions = [
  ["kitchen.read", "Ver cocina"],
  ["kitchen.confirm", "Confirmar preparaciones"],
  ["tasks.read", "Ver sus tareas"],
  ["tasks.update", "Completar sus tareas"],
  ["assets.read", "Ver activos"],
  ["assets.write", "Editar activos"],
  ["inventory.read", "Consultar despensa"],
  ["inventory.write", "Registrar compras y conteos"],
] as const;
export type Permission = (typeof permissionOptions)[number][0];
export type Membership = {
  household_id: string;
  user_id: string;
  role: "admin" | "collaborator";
  display_name: string;
  active: boolean;
  is_principal: boolean;
  permissions: Permission[];
};
