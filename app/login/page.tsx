import { LoginForm } from "./login-form";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function LoginPage({ searchParams }: Props) {
  const err = searchParams.error;
  const error = typeof err === "string" ? err : undefined;
  return <LoginForm error={error} />;
}
