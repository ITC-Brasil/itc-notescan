"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
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
import { NoteScanLogo } from "@/components/brand/NoteScanLogo";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { APP_VERSION } from "@/lib/constants";
import { HOME_BY_ROLE, isHumanRole } from "@/lib/auth/roles";

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

    const session = await fetch("/api/auth/session").then((r) => r.json());
    const role: unknown = session?.user?.role;
    if (!isHumanRole(role)) {
      setError("Acesso não permitido.");
      return;
    }
    router.push(HOME_BY_ROLE[role]);
  };

  return (
    // Login unificado: uma estrutura só em todas as larguras — lockup Mira
    // centralizado acima de um card com o formulário. Única diferença responsiva:
    // largura máxima / padding do card e o font-size do lockup.
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm md:max-w-md flex flex-col items-center">
        {/* Marca — lockup horizontal reconstruído em HTML (símbolo + texto real).
            font-size do container define a escala; medidas em em travam a proporção. */}
        <div className="flex items-center gap-[0.25em] text-[56px] min-[400px]:text-[64px]">
          <NoteScanLogo size={64} className="w-[1em] h-[1em] shrink-0" />
          <span className="flex flex-col items-start leading-none gap-[0.125em]">
            <span className="font-archivo font-semibold uppercase text-[0.1875em] tracking-[0.42em] text-itc-ciano-7">
              ITC
            </span>
            <span className="font-archivo font-extrabold text-[0.625em] tracking-[-0.025em] text-foreground">
              NoteScan
            </span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-3 mb-8 text-center">
          Sistema de conferência de ativos
        </p>

        {/* Card — envolve o formulário em todas as larguras */}
        <div className="w-full rounded-2xl border border-border bg-card shadow-1 p-6 md:p-8">
          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl md:text-lg font-bold text-foreground">Acesse sua conta</h2>
          </div>

          <Form {...form}>
          {/* method="post": submit antes da hidratação não pode vazar a senha na URL */}
          <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={LABEL_CLASS}>E-mail</FormLabel>
                  <div className="relative">
                    <Mail className={FIELD_ICON_CLASS} />
                    {/* FormControl no Input (não na div) para o label associar ao campo. */}
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className="h-12 pl-10 bg-background text-base"
                        {...field}
                      />
                    </FormControl>
                  </div>
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
                  <div className="relative">
                    <Lock className={FIELD_ICON_CLASS} />
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-12 pl-10 pr-11 bg-background text-base"
                        {...field}
                      />
                    </FormControl>
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
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Grupo ITC Brasil · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
