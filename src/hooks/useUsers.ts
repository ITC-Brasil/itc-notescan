import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HumanRole } from "@/lib/auth/roles";
import type { CreateUserInput } from "@/lib/validations";

export interface User {
  id: string;
  nome: string;
  email: string;
  // A API devolve qualquer valor do enum do banco — não só roles humanas.
  role: HumanRole | (string & {});
  metaDiaria: number;
  createdAt: string;
}

type UpdateUserInput = {
  nome: string;
  email: string;
  role: HumanRole;
  metaDiaria: number;
  password?: string;
};

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Falha ao carregar usuários");
  return res.json() as Promise<User[]>;
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: fetchUsers });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<User>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserInput }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<User>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}
