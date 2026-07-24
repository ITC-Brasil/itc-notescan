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
    // Single responsive login: mobile keeps the Fase 2 layout (brand row, fields
    // on the background, no card); from `md` up it becomes a centered column with
    // a card — same component, no duplication.
    <div className="min-h-screen flex flex-col justify-center bg-background px-6 py-10 md:items-center">
      <div className="w-full max-w-sm mx-auto md:max-w-101">
        {/* Marca */}
        <div className="flex items-center gap-3 mb-8 md:flex-col md:items-center md:text-center md:gap-3 md:mb-6">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl md:rounded-[15px] bg-primary flex items-center justify-center shrink-0">
            <ScanLine className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-bold md:font-extrabold md:font-archivo text-foreground leading-tight">
              ITC NoteScan
            </h1>
            <p className="text-sm text-muted-foreground leading-tight md:mt-1">
              <span className="md:hidden">Conferência de ativos</span>
              <span className="hidden md:inline">Painel administrativo · Grupo ITC Brasil</span>
            </p>
          </div>
        </div>

        {/* Form — card a partir de md */}
        <div className="md:rounded-2xl md:border md:border-border md:bg-card md:shadow-1 md:p-6">
          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl md:text-lg font-bold text-foreground">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground mt-1 md:hidden">
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
                        className="h-12 pl-10 bg-card md:bg-background text-base"
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
                        className="h-12 pl-10 pr-11 bg-card md:bg-background text-base"
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
              className="block w-full text-center md:text-right text-sm font-semibold text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
          </form>
          </Form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          <span className="md:hidden">Grupo ITC Brasil · v1.0</span>
          <span className="hidden md:inline">Sistema de conferência de ativos · ITC Brasil</span>
        </p>
      </div>
    </div>
  );
}
