import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET || "solux-default-secret-key-12345",
});

export const config = {
    // Protects all routes except login, api, and static files
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png|login).*)"],
};
