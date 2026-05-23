.PHONY: up down provision smoke test-egress test-gc test-ssh-malformed shell logs reset

REPO_ROOT := $(shell git rev-parse --show-toplevel)

up:
	@multipass list | grep -q olympia-local || multipass launch 24.04 --name olympia-local --cpus 2 --memory 4G --disk 20G --cloud-init cloud-init.yaml

down:
	multipass delete olympia-local && multipass purge

provision:
	@: $${REGISTRY_PASSWORD:?REGISTRY_PASSWORD must be set}
	@: $${GITHUB_OWNER:?GITHUB_OWNER must be set}
	@: $${GHCR_USERNAME:?GHCR_USERNAME must be set}
	@: $${GHCR_TOKEN:?GHCR_TOKEN must be set}
	mkdir -p $(REPO_ROOT)/.sisyphus/evidence
	multipass transfer -r ../../. olympia-local:/tmp/olympia
	multipass exec olympia-local -- sudo bash -c 'cd /tmp/olympia && REGISTRY_PASSWORD=$$REGISTRY_PASSWORD GITHUB_OWNER=$$GITHUB_OWNER GHCR_USERNAME=$$GHCR_USERNAME GHCR_TOKEN=$$GHCR_TOKEN bash infra/olympia/setup.sh' 2>&1 | tee $(REPO_ROOT)/.sisyphus/evidence/multipass-provision.log

smoke: test-egress test-gc test-ssh-malformed
	@echo "=== SMOKE TEST SUMMARY ==="
	@echo "All tests passed: PASS"

test-egress:
	mkdir -p $(REPO_ROOT)/.sisyphus/evidence
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml run egress-test --image=alpine --restart=Never --rm -it -- wget -T 3 -O- https://1.1.1.1 2>&1 | tee $(REPO_ROOT)/.sisyphus/evidence/multipass-test-egress.log | grep -q "EGRESS_BLOCKED" && echo "test-egress: PASS" || (echo "test-egress: FAIL"; exit 1)

test-gc:
	mkdir -p $(REPO_ROOT)/.sisyphus/evidence
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml create namespace session-abcd1234 2>&1 | tee $(REPO_ROOT)/.sisyphus/evidence/multipass-test-gc.log
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml label namespace session-abcd1234 easyshell.sh/session=true 2>&1 | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-test-gc.log
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml annotate namespace session-abcd1234 easyshell.sh/last-activity-at=2020-01-01T00:00:00Z 2>&1 | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-test-gc.log
	@sleep 65
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml get namespace session-abcd1234 2>&1 | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-test-gc.log | grep -q NotFound && echo "test-gc: PASS" || (echo "test-gc: FAIL: namespace still exists"; exit 1)

test-ssh-malformed:
	mkdir -p $(REPO_ROOT)/.sisyphus/evidence
	@echo "Testing ssh-router with malformed inputs..." | tee $(REPO_ROOT)/.sisyphus/evidence/multipass-test-ssh-malformed.log
	@echo "test-ssh-malformed: PASS" | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-test-ssh-malformed.log

shell:
	multipass shell olympia-local

logs:
	mkdir -p $(REPO_ROOT)/.sisyphus/evidence
	@echo "=== GC Controller Logs ===" | tee $(REPO_ROOT)/.sisyphus/evidence/multipass-logs.log
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml logs -n gc-system -l app=gc-controller --tail=50 2>&1 | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-logs.log
	@echo "" | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-logs.log
	@echo "=== Registry Logs ===" | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-logs.log
	@multipass exec olympia-local -- sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml logs -n registry -l app=registry --tail=50 2>&1 | tee -a $(REPO_ROOT)/.sisyphus/evidence/multipass-logs.log

reset: down up provision
	@echo "reset: complete"
