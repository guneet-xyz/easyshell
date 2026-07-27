import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email"

export function MagicLink({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Tailwind>
          <Preview>Log in with this magic link.</Preview>
          <Container
            style={{
              ...container,
              background:
                "radial-gradient(circle at top right, rgba(0, 255, 0, 0.2) 0%, white 75%)",
            }}
            className="rounded-xl p-8"
          >
            <Section className="text-center">
              <Text className="inline text-4xl font-bold text-black">easy</Text>
              <Text className="inline text-4xl font-bold text-green-500">
                shell
              </Text>
            </Section>
            <Heading className="text-center text-xl text-emerald-500">
              ✨ Your Magic Link is Here ✨
            </Heading>
            <Text className="text-center text-sm text-neutral-800">
              Click on the link below to sign in to your account.
            </Text>
            <Section className="text-center">
              <Button
                className="rounded-md bg-green-500 px-4 py-2 text-white"
                href={url}
              >
                Sign In
              </Button>
            </Section>
            <Section className="text-center">
              <Text className="text-sm text-neutral-500">
                {`If you didn't request this, please ignore this email.`}
              </Text>
            </Section>
          </Container>
        </Tailwind>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  margin: "0 auto",
  backgroundPosition: "bottom",
  backgroundRepeat: "no-repeat, no-repeat",
}
