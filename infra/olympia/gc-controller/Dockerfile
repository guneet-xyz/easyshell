FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o gc-controller .

FROM gcr.io/distroless/static-debian12:nonroot
LABEL easyshell.sh/component=gc-controller
COPY --from=builder /app/gc-controller /gc-controller
ENTRYPOINT ["/gc-controller"]
