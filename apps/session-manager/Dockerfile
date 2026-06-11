FROM golang:1.23-alpine AS build

WORKDIR /src
COPY . .

RUN go build -o session-manager

FROM alpine:3.21

RUN apk add --no-cache docker
EXPOSE 4000

COPY --from=build /src/session-manager /session-manager

ENTRYPOINT ["/session-manager"]
