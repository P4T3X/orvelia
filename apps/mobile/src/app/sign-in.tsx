import { loginSchema, registerSchema } from "@orvelia/schemas";
import * as Linking from "expo-linking";
import * as React from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Field, Notice, Screen, Text } from "@/components/ui";
import { env, isConfigured } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { space, useColors } from "@/lib/theme";

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña no son correctos.",
  email_not_confirmed: "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.",
  user_already_exists: "Ya existe una cuenta con este correo. Inicia sesión.",
  weak_password: "La contraseña es demasiado débil. Usa una más larga.",
  over_request_rate_limit: "Demasiados intentos. Espera unos minutos.",
};

export default function SignIn() {
  const c = useColors();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setMessage(null);
    const parsed =
      mode === "signin"
        ? loginSchema.safeParse({ email, password })
        : registerSchema.safeParse({ fullName, email, password, confirmPassword: password, acceptTerms: true });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage({ tone: "error", text: AUTH_ERRORS[error.code ?? ""] ?? "No pudimos iniciar sesión. Inténtalo de nuevo." });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: env.apiUrl ? `${env.apiUrl}/auth/confirm` : undefined },
        });
        if (error) setMessage({ tone: "error", text: AUTH_ERRORS[error.code ?? ""] ?? "No pudimos crear tu cuenta. Inténtalo de nuevo." });
        else if (!data.session) setMessage({ tone: "success", text: "Te enviamos un correo para confirmar tu cuenta. Después vuelve aquí e inicia sesión." });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["top", "bottom"]} style={{ flexGrow: 1, justifyContent: "center", maxWidth: 440, width: "100%", alignSelf: "center" }}>
        <View style={{ gap: space.sm, marginBottom: space.md }}>
          <Text style={{ fontSize: 15, letterSpacing: 5, fontWeight: "600" }}>
            ORVELIA <Text style={{ color: c.accent }}>●</Text>
          </Text>
          <Text variant="title" accessibilityRole="header">
            {mode === "signin" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </Text>
          <Text muted>Todo lo que posees, sus garantías y comprobantes, en un solo lugar.</Text>
        </View>

        {!isConfigured() && <Notice tone="error" title="La app no está configurada." >Faltan las variables EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.</Notice>}
        {message && <Notice tone={message.tone} title={message.text} />}

        {mode === "signup" && (
          <Field label="Nombre completo" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" error={errors.fullName} />
        )}
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={errors.email}
          testID="email"
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          textContentType={mode === "signin" ? "password" : "newPassword"}
          error={errors.password}
          hint={mode === "signup" ? "Mínimo 8 caracteres." : undefined}
          onSubmitEditing={submit}
          testID="password"
        />
        <Button label={mode === "signin" ? "Iniciar sesión" : "Crear cuenta"} onPress={submit} loading={pending} testID="submit" />
        {mode === "signup" && (
          <Text variant="small" muted>
            Al crear tu cuenta aceptas los Términos y la Política de privacidad de ORVELIA.
          </Text>
        )}
        <View style={{ gap: space.xs }}>
          <Button
            variant="ghost"
            label={mode === "signin" ? "¿No tienes cuenta? Crea una" : "¿Ya tienes cuenta? Inicia sesión"}
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setErrors({});
              setMessage(null);
            }}
          />
          {mode === "signin" && env.apiUrl ? (
            <Button variant="ghost" label="Olvidé mi contraseña" onPress={() => Linking.openURL(`${env.apiUrl}/forgot-password`)} />
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
