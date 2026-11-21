"use client";

import {
  FAMILY_ROLE_DESCRIPTIONS,
  FAMILY_ROLE_LABELS,
  canInviteRole,
  type FamilyRole,
} from "@orvelia/domain";
import { familyInviteSchema, familyNameSchema } from "@orvelia/schemas";
import { Check, Copy, Link2, LogOut, Pencil, Share2, Trash2, UserMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  acceptInvitation,
  changeMemberRole,
  createFamily,
  deleteFamily,
  inviteMember,
  leaveFamily,
  removeMember,
  renameFamily,
  revokeInvitation,
  setProductShared,
  type InviteResult,
} from "@/app/app/family/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useActionForm } from "@/lib/use-action-form";

export function CreateFamilyForm({ suggestion }: { suggestion: string }) {
  const { form, onSubmit, pending, result } = useActionForm(familyNameSchema, { name: suggestion }, createFamily);
  const router = useRouter();
  const { errors } = form.formState;
  React.useEffect(() => {
    if (result?.ok) {
      toast.success(result.message);
      router.refresh();
    }
  }, [result, router]);
  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-5">
      {result && !result.ok && <Alert tone="error" title={result.message} />}
      <Field id="name" label="Nombre de la familia" error={errors.name?.message} hint="Lo verán las personas que invites.">
        <Input {...fieldAria("name", errors.name?.message, true)} {...form.register("name")} maxLength={60} />
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Crear familia
        </Button>
      </div>
    </form>
  );
}

export function RenameFamily({ name }: { name: string }) {
  const [editing, setEditing] = React.useState(false);
  const router = useRouter();
  const { form, onSubmit, pending } = useActionForm(familyNameSchema, { name }, async (v) => {
    const res = await renameFamily(v);
    if (res.ok) {
      toast.success(res.message);
      setEditing(false);
      router.refresh();
    } else if (!res.fieldErrors) toast.error(res.message);
    return res;
  });
  const { errors } = form.formState;

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        Cambiar nombre
      </Button>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-md items-start gap-2">
      <div className="grid flex-1 gap-1">
        <Input
          aria-label="Nombre de la familia"
          {...fieldAria("rename", errors.name?.message)}
          {...form.register("name")}
          maxLength={60}
          autoFocus
        />
        {errors.name?.message && <p className="text-[13px] text-danger">{errors.name.message}</p>}
      </div>
      <Button type="submit" loading={pending}>
        Guardar
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label="Cancelar" onClick={() => setEditing(false)}>
        <X aria-hidden />
      </Button>
    </form>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={link} aria-label="Enlace de invitación" className="font-mono text-[13px]" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("No se pudo copiar. Selecciona el enlace y cópialo.");
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function InviteForm({ myRole, seatsLeft }: { myRole: FamilyRole; seatsLeft: number }) {
  const router = useRouter();
  const [last, setLast] = React.useState<InviteResult | null>(null);
  const { form, onSubmit, pending, result } = useActionForm(familyInviteSchema, { email: "", role: "member" }, async (v) => {
    const res = await inviteMember(v);
    if (res.ok && res.data) setLast(res.data);
    return res;
  });
  const { errors } = form.formState;
  React.useEffect(() => {
    if (result?.ok) {
      form.reset({ email: "", role: "member" });
      router.refresh();
    }
  }, [result, form, router]);

  return (
    <div className="grid gap-5">
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start">
        <Field id="email" label="Correo" error={errors.email?.message}>
          <Input
            {...fieldAria("email", errors.email?.message)}
            {...form.register("email")}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nombre@correo.com"
            disabled={seatsLeft <= 0}
          />
        </Field>
        <Field id="role" label="Rol" error={errors.role?.message}>
          <Select {...fieldAria("role", errors.role?.message)} {...form.register("role")} disabled={seatsLeft <= 0}>
            <option value="member">{FAMILY_ROLE_LABELS.member}</option>
            {canInviteRole(myRole, "admin") && <option value="admin">{FAMILY_ROLE_LABELS.admin}</option>}
          </Select>
        </Field>
        <div className="sm:pt-[1.625rem]">
          <Button type="submit" loading={pending} disabled={seatsLeft <= 0} className="w-full sm:w-auto">
            Invitar
          </Button>
        </div>
      </form>
      <p className="-mt-2 text-[13px] text-muted-foreground">
        {seatsLeft > 0
          ? `Quedan ${seatsLeft} ${seatsLeft === 1 ? "lugar" : "lugares"}. La invitación vence en 7 días y solo la puede aceptar ese correo.`
          : "No quedan lugares. Cancela una invitación o retira a un miembro para invitar a alguien más."}
      </p>
      {result && !result.ok && !result.fieldErrors && <Alert tone="error" title={result.message} />}
      {last && (
        <div className="grid gap-3 rounded-xl border border-border bg-muted/50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4 text-accent-ink" aria-hidden />
            {last.emailStatus === "sent"
              ? `Le enviamos la invitación a ${last.email}. También puedes mandarle este enlace:`
              : `Invitación creada. Mándale este enlace a ${last.email} (por WhatsApp, por ejemplo):`}
          </p>
          <CopyLink link={last.link} />
          <p className="text-[13px] text-muted-foreground">Por seguridad, el enlace se muestra solo esta vez.</p>
        </div>
      )}
    </div>
  );
}

export function RevokeInvitation({ id, email }: { id: string; email: string }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      aria-label={`Cancelar invitación a ${email}`}
      onClick={() =>
        start(async () => {
          const res = await revokeInvitation(id);
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        })
      }
    >
      Cancelar
    </Button>
  );
}

export function MemberRoleSelect({ userId, role, name }: { userId: string; role: Exclude<FamilyRole, "owner">; name: string }) {
  const [current, setCurrent] = React.useState(role);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Select
      aria-label={`Rol de ${name}`}
      value={current}
      disabled={pending}
      className="h-9 w-40"
      onChange={(e) => {
        const next = e.target.value as Exclude<FamilyRole, "owner">;
        const prev = current;
        setCurrent(next);
        start(async () => {
          const res = await changeMemberRole({ userId, role: next });
          if (res.ok) {
            toast.success(`${name} ahora es ${FAMILY_ROLE_LABELS[next].toLowerCase()}.`);
            router.refresh();
          } else {
            setCurrent(prev);
            toast.error(res.message);
          }
        });
      }}
    >
      <option value="member">{FAMILY_ROLE_LABELS.member}</option>
      <option value="admin">{FAMILY_ROLE_LABELS.admin}</option>
    </Select>
  );
}

export function RemoveMember({ userId, name }: { userId: string; name: string }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <ConfirmDialog
      title={`¿Retirar a ${name}?`}
      description="Dejará de ver lo que comparte la familia y sus productos dejarán de compartirse. Sus datos siguen en su cuenta."
      confirmLabel="Retirar"
      pending={pending}
      onConfirm={() =>
        start(async () => {
          const res = await removeMember(userId);
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        })
      }
      trigger={(open) => (
        <Button variant="ghost" size="icon" aria-label={`Retirar a ${name}`} onClick={open}>
          <UserMinus aria-hidden />
        </Button>
      )}
    />
  );
}

export function LeaveOrDeleteFamily({ isOwner, familyName }: { isOwner: boolean; familyName: string }) {
  const [pending, start] = React.useTransition();
  return (
    <ConfirmDialog
      title={isOwner ? `¿Eliminar la familia ${familyName}?` : `¿Salir de ${familyName}?`}
      description={
        isOwner
          ? "Todos los miembros dejarán de ver lo compartido y se cancelarán las invitaciones pendientes. Los productos de cada persona siguen en su cuenta."
          : "Dejarás de ver lo que comparte la familia y tus productos dejarán de compartirse. Tus datos siguen en tu cuenta."
      }
      confirmLabel={isOwner ? "Eliminar familia" : "Salir de la familia"}
      pending={pending}
      onConfirm={() =>
        start(async () => {
          const res = await (isOwner ? deleteFamily() : leaveFamily());
          if (res && !res.ok) toast.error(res.message);
        })
      }
      trigger={(open) => (
        <Button variant="secondary" onClick={open}>
          {isOwner ? <Trash2 aria-hidden /> : <LogOut aria-hidden />}
          {isOwner ? "Eliminar familia" : "Salir de la familia"}
        </Button>
      )}
    />
  );
}

export function AcceptInvitation({ token }: { token: string }) {
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="grid gap-4">
      {error && <Alert tone="error" title={error} />}
      <div>
        <Button
          size="lg"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await acceptInvitation(token);
              if (res && !res.ok) setError(res.message ?? "No pudimos aceptar la invitación.");
            })
          }
        >
          Unirme a la familia
        </Button>
      </div>
    </div>
  );
}

/** Product page control: share a product of mine with my family (read-only for them). */
export function ShareToggle({ productId, shared, familyName }: { productId: string; shared: boolean; familyName: string }) {
  const [isShared, setShared] = React.useState(shared);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      loading={pending}
      aria-pressed={isShared}
      title={isShared ? `Compartido con ${familyName}` : `Compartir con ${familyName}`}
      onClick={() =>
        start(async () => {
          const res = await setProductShared({ productId, shared: !isShared });
          if (res.ok && res.data) {
            setShared(res.data.shared);
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        })
      }
    >
      {isShared ? <Check aria-hidden /> : <Share2 aria-hidden />}
      {isShared ? "Compartido con la familia" : "Compartir con la familia"}
    </Button>
  );
}

export function RoleHelp() {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      {(["owner", "admin", "member"] as const).map((r) => (
        <div key={r}>
          <dt className="font-medium">{FAMILY_ROLE_LABELS[r]}</dt>
          <dd className="mt-0.5 text-muted-foreground">{FAMILY_ROLE_DESCRIPTIONS[r]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Unshare from the family page (product owner, or owner/admin). */
export function UnshareButton({ productId, name }: { productId: string; name: string }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      aria-label={`Dejar de compartir ${name}`}
      onClick={() =>
        start(async () => {
          const res = await setProductShared({ productId, shared: false });
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        })
      }
    >
      Dejar de compartir
    </Button>
  );
}
