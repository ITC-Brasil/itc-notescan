"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ScanLine, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { loginSchema, type LoginInput } from "@/lib/validations";

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const FIELD_ICON_CLASS = "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setError(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha inválidos.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm mx-auto">
        {/* Marca */}
        <div className="flex items-center gap-3 mb-10">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <ScanLine className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">ITC NoteScan</h1>
            <p className="text-sm text-muted-foreground leading-tight">Conferência de ativos</p>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Acesse sua conta</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Entre com suas credenciais de técnico
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={LABEL_CLASS}>E-mail</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className={FIELD_ICON_CLASS} />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className="h-12 pl-10 bg-card text-base"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={LABEL_CLASS}>Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className={FIELD_ICON_CLASS} />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-12 pl-10 pr-11 bg-card text-base"
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p className="text-sm text-destructive text-center rounded-lg bg-destructive/10 py-2 px-3">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold uppercase tracking-wide"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
            </Button>

            <button
              type="button"
              onClick={() =>
                toast.info("Solicite a redefinição de senha ao administrador.")
              }
              className="block w-full text-center text-sm font-semibold text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
          </form>
        </Form>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Grupo ITC Brasil · v1.0
        </p>
      </div>
    </div>
  );
}
