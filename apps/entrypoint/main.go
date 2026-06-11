package main

import (
	"entrypoint/session"
	"entrypoint/submission"
	"flag"
	"fmt"
	"os"
)

func main() {
	modePtr := flag.String("mode", "unset", "(required) mode in which you which to execute the image")

	flag.Parse()

	switch *modePtr {

	case "unset":
		panic("-mode: option is required")
	case "session":
		fmt.Println("running in session mode")
		session.Main()
	case "submission":
		fmt.Println("running in submission mode")
		submission.Main()
	default:
		panic("-mode: provide a valid value ('session' or 'submission')")
	}

	os.Exit(0)
}
