import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDemoLoginEnabled } from "@/lib/demo-mode";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && !nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET must be configured in production.");
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "name@company.com" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (
          user.isDemo &&
          !isDemoLoginEnabled(
            process.env.NODE_ENV,
            process.env.ENABLE_DEMO_LOGIN,
            process.env.DEMO_DATABASE_ISOLATED,
          )
        ) return null;

        const passwordIsValid = await compare(parsed.data.password, user.passwordHash);
        if (!passwordIsValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        if (token.role) session.user.role = token.role;
      }
      return session;
    },
  },
};
