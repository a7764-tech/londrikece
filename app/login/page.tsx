import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Login Kasir | Londri Kece",
  description: "Login kasir Londri Kece.",
};

export default function LoginPage() {
  return <LoginForm />;
}
