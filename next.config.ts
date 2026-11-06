import type { NextConfig } from "next";
const config: NextConfig = { outputFileTracingIncludes: { "/report": ["./report/**"] } };
export default config;
