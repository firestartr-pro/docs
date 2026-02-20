# Build and dispatch workflows

This feature is a collection of seven workflows (along with their configuration files), which when used in conjunction allow a user to build final docker images from a release tag, or snapshot images, from a pre-release tag, or commit SHA; Once the images are built, the `make_dispatches` workflow dispatches the image update automatically to their respective state repositories. They can be thought of as two different but closely related features.

The workflows `trigger_dispatch_on_releases.yaml`, `trigger_dispatch_on_pre-releases.yaml` and `trigger_dispatch_on_snapshot.yaml` only serve to trigger `make_dispatches.yaml` after a successful automated call to any of the `build_docker_<type>.yaml` workflows. They require no other explanation so they won't be discussed in this README



## Build images

Composed of the workflows `.github/workflows/build_docker_releases.yaml`, `.github/workflows/build_docker_pre-releases.yaml` and `.github/workflows/build_docker_snapshots.yaml`.

#### Configuration

All build workflows use the same configuration file located at `.github/build_images.yaml`. Its format is as follows:

```yaml
snapshots:  # Configuration specific for snapshots, used by build_docker_pre-releases and build_docker_snapshots
  flavor:  # Flavor-specific configuration. A flavor can be named anything as long as it's a valid YAML key
    dockerfile: path/to/dockerfile  # Path relative to the repo root folder
    auto: false  # Whether or not to automatically build this flavor when the * input is specified (see "Inputs" below). Defaults to false
    build_args:  # Environment variables to set during the image building process
      #  ENV_VARIABLE_NAME: env_variable_value
      API_URL: https://api.com/url
      UI_COLOR: '#125690'
    extra_registries:  # List of registries, other than the default one (see "Defaults" below), where to upload the image
      - name: registry.azure.io
        repository: service/repo
        auth_strategy: azure_oidc
      # Multiple kinds of registries can be specified
      - name: aws.amazon.com
        repository: programs/program-name  # Repository names can be different between registries
        auth_strategy: aws_oidc  # Multiple auth strategies should be supported but they currently aren't
    extra_tags: # List of extra tags to publish the image as
      - latest
      - stable
    platforms:  # List of platforms for which to build the image. If unspecified, the image will be built for linux/amd64 only
      # Only linux/amd64 and linux/arm64 are currently supported
      - linux/amd64
      - linux/arm64

  another-flavor:
    dockerfile: path/to/dockerfile
    registry:  # The default registry can be overridden (see "Defaults" below)
      name: nondefault.registry.es
      repository: nondefault/repo
      auth_strategy: azure_oidc  # Can be any of azure_oidc or aws_oidc


releases:  # Configuration specific for releases, used by build_docker_releases
  release-flavor:
    ...  # The same configuration parameters as snapshots can be used here

```

- `snapshots`: all image flavors included within this key will count as a snapshot flavor, and thus will be built when the `build_docker_snapshots` or `build_docker_pre-releases` workflows are executed
- `releases`: all image flavors included within this key will count as a release flavor, and thus will be built when the `build_docker_releases` workflow is executed

Inside each of these two keys (`type` keys) there will be one or more flavor keys:

- `<flavor>`: the name of the flavor to build. Will be appended to the end of the final image tag. The same flavor name cannot be duplicated inside the same `type` key, but it can be in both `type` keys at the same time (i.e. `snapshots` cannot contain two `default` flavor keys, but both `snapshots` and `releases` can contain a single `default` key at the same time)

Each flavor key can contain:

- `dockerfile`: path to the dockerfile to use when building this image, relative to the repo root (i.e. if the dockerfile is located at `https://www.github.com/firestartr-test/code-repo/docker/Dockerfile`, this keys' value will be `docker/Dockerfile`)
- `auto`: whether or not to build this flavor when the [`flavors` input](#inputs) equals \*. [Defaults to false](#defaults)
- `build_args`: key-value pairs that are set as environment variables when building the image. The key is the environment value name, and the value its value, and any number of them can be specified.
- `registry`: a [`registry` object](#registry-objects) that overrides the [default registry](#defaults). If this key is specified, ***no image will be uploaded to the [default registry](#defaults)***
- `extra_registries`: a list of [`registry` object](#registry-objects) to where the image will be uploaded to, in addition to the [default registry](#defaults). If this key is specified, ***the image will still be uploaded to the [default registry](#defaults)***
- `extra_tags`: optional list of strings representing extra tags to publish the image as. While the default tag is constructed as `<flavor>_<version>`, no extra info will be appended to these tags. E.g. if the flavor is `default` and the version is `v1.2.3`, the default tag will be `default_v1.2.3`, and if `latest` is specified as an extra tag, the image will also be tagged as `latest`. For this reason, all values listed as `extra_tags` must be unique across all flavors and types (i.e., two different flavors cannot both have `latest` as an extra tag, even if one is a snapshot and the other a release)
- `platforms`: optional list of strings representing platforms for which to build the image. If unspecified, the image will be built for `linux/amd64` only. Currently, only `linux/amd64` and `linux/arm64` are supported. If specified, the image will be built only for the platform(s) listed.

#### Registry objects

A registry object contains the following keys:

- `name`: base URL of the registry. E.g. when uploading a image to `registry.com/image_repo/image_tag`, this key's value should be `registry.com`
- `repository`: name of the repository inside of the registry `name` to where upload the image to. E.g. when uploading a image to `registry.com/image_repo/image_tag`, this key's value should be `image_repo`
- `auth_strategy`: type of authentication to use for login, as different registries require different authentication methods. Though many are defined, currently only `azure_oidc` and `aws_oidc` are supported

#### Inputs

All build workflows use the same inputs. They are:

- `from`: point of the code history from which the image will be built. Can be a short or long commit SHA, a branch name or a tag name
- `flavors`: which flavors to build. Each workflow will only look for flavors in their respective section (i.e., build_docker_releases will only build flavors from `releases`, while the other two will only build flavors from `snapshots`). Can be a single flavor, a list of comma separated flavors (spaces are trimmed) or \*. \* builds all flavors that are set as auto in `build_images.yaml` (see [Configuration](#configuration))

#### Defaults

All build workflows use the same defaults. There are two types of defaults: environment variables and defaults defined by code. The environment variables are:

- `DOCKER_REGISTRY_RELEASES`: base URL of the Docker registry for releases. Follows the same format as `extra_registries.name` and `registry.name` (e.g. `prefapp.azureacr.io`. See [Configuration](#configuration))
- `DOCKER_REGISTRY_SNAPSHOTS`: base URL of the Docker registry for snapshots. Follows the same format as `extra_registries.name` and `registry.name` (e.g. `prefapp.azureacr.io`. See [Configuration](#configuration))


The defaults defined by code are:

- `registry.repository` defaults to the name of the repo the workflow is being executed on, including the owner. E.g. `prefapp/test-repo-rundagger`
- `flavor.auto` defaults to `false`




## Make dispatches

Composed of the workflow `.github/workflows/make_dispatches.yaml`.

#### Configuration

The `make_dispatches` workflow uses the configuration file located at `.github/make_dispatches.yaml`. Its format is as follows:

```yaml
deployments:  # Has a list of configurations
  - tenant: prefapp
    platform: az-cluster  # Platform where we want to dispatch changes to
    type: snapshots  # Either snapshots or releases
    flavor: flavor1  # Flavor to dispatch for this deployment. Must have the same name as a flavor defined in build_images.yaml, under the chosen type (see "Build images -> Configuration" above)
    version: $branch_dev  # See "About the version field" below
    registry: prefapp.azureacr.io  # Optional. Registry where the image was uploaded to (see "Defaults" below)
    image_repository: service/test-repo  # Optional. Repo where the image was uploaded to (see "Defaults" below)

    base_path: apps  # Can be left empty or unspecified
    application: test-repo-rundagger
    env: dev

    # You can specify one of the following
    service_names: ['test-repo-service']  # List, multiple services can be specified
    # OR
    image_keys: ['/test-repo-service/image']  # List, multiple image keys can be specified

    # So, in this example github.com/prefapp/prefapp-state/apps/<platform-type>/az-cluster/prefapp/test-repo-rundagger/dev would be updated when making this dispatch

  # An entry is created for each tenant - platform - type - flavor combination we want to dispatch
  - tenant: prefapp
    platform: az-cluster
    type: snapshots
    flavor: another-flavor
    ...

  - tenant: prefapp
    platform: aks-cluster
    type: snapshots
    flavor: flavor1
    ...
```

- `deployments`: contains the list of deployments to dispatch. Has no special data or meaning but must be specified for the dispatch workflow to work

Each deployment contains:

- `tenant`: name of the tenant that will be used for this deployment. Used to determine which file to update when dispatching, and also for validation: the tenant must be specified in the list of valid tenants in the platform configuration of the `.firestartr` repo
- `platform`: name of the platform that will be used for this deployment. Used to determine which file to update when dispatching, and also for validation: the specified platform must have an associated configuration file. From the platform configuration file, it's `type` will also be used when determining which file to update.
- `type`: deployment type, can be either of `snapshots` or `releases`. Used when calling the dispatch workflow to filter which dispatches to make.
- `flavor`: name of the flavor that will be used for this deployment. Used to compose the image tag, which will be written to the corresponding deployment files and must have been built beforehand.
- `version`: version of the code used in the image. Used to compose the image tag, which will be written to the corresponding deployment manifests and must have been built beforehand. See [About the version field](#about-the-version-field) for more info on the possible values this parameter could have.
- `registry`: registry to where the image has been uploaded to. This parameter is optional, and the registry specified in either the `DOCKER_REGISTRY_RELEASES` and `DOCKER_REGISTRY_SNAPSHOTS` variables will be used by default (see [Defaults](#defaults-1)).
- `image_repository`: repository to where the image has been uploaded to. This parameter is optional, and the repository specified in the application configuration will be used by default.
- `base_path`: legacy parameter. Appends this value to the deployment path, so that the final result ends like: `<base_path>/<platform-type>/<platform>/<tenant>/<env>`. Should only be used when dispatching to an old state repository.
- `application`: name of the application that will be dispatched. Used for validation, as a valid configuration must exist for the application, and to get the default state and image repo.
- `env`: environment where to deploy to. Could technically be any string, but usually is one of `dev`, `pre` or `pro`. Must be a value included in the `registry` configuration file.
- `service_names`: names of the services this deployment will be dispatched to. These values will be validated against the application configuration in the `.firestartr` repo: each value of this field must be included within the `service_names` of the current repository for this deployment's application. Cannot be used at the same time as the `image_keys` parameter.
- `image_keys`: list of JSONPatch paths to patch the deployment YAMLs. These values aren't validated against any configuration file. Cannot be used at the same time as the `service_names` parameter.

#### Workflow inputs

- `image_type`: which types of images to build. Can be `releases`, `snapshots` (default) or `*` (both)
- `flavors`: which flavors to dispatch. Will only look for flavors inside `image_type`. Can be a single flavor, a list of comma separated flavors (spaces are trimmed) or `*`. `*` builds all flavors that are set as auto in `build_images.yaml` (see [Build Images -> Configuration](#configuration))
- `overwrite_version`: instead of using `version`, the value of this input will be used for each `image_type` and `flavors` if specified. Can be any of the valid `make_dispatches.yaml` configuration keywords (see [About the version field](#about-the-version-field))
- `overwrite_tenant`: instead of using `tenant`, the value of this input will be used for each `image_type` and `flavors` if specified.
- `overwrite_env`: instead of using `env`, the value of this input will be used for each `image_type` and `flavors` if specified.
- `filter_by_tenant`: only dispatch to the `tenant` specified by this input. These tenants must already have an entry in `make_dispatches.yaml` for `image_type` and `flavors` (i.e. this filter won't do anything if the `flavors` of `image_type` could not be dispatched to `filter_by_tenant` to begin with). Can be a single tenant, a list of comma separated tenants (spaces are trimmed) or `*` (all tenants for a given `image_type` and `flavors`)
- `filter_by_env`: only dispatch to the `env` specified by this input. These envs must already have an entry in `make_dispatches.yaml` for `image_type` and `flavors` (i.e. this filter won't do anything if the `flavors` of `image_type` could not be dispatched to `filter_by_env` to begin with). Can be a single env, a list of comma separated envs (spaces are trimmed) or `*` (all envs for a given `image_type` and `flavors`)
- `filter_by_platform`: only dispatch to the `platform` specified by this input. These platforms must already have an entry in `make_dispatches.yaml` for `image_type` and `flavors` (i.e. this filter won't do anything if the `flavors` of `image_type` could not be dispatched to `filter_by_platform` to begin with). Can be a single platform, a list of comma separated platforms (spaces are trimmed) or `*` (all platforms for a given `image_type` and `flavors`)
- `workflow_run_id`: the workflow needs the build summary of the last `build_docker_<type>`. If you have access to it, you can give it as an input here. If left blank, it will be automatically calculated by the workflow

#### Defaults

The defaults are defined as environment variables and are:

- `DOCKER_REGISTRY_RELEASES`: base URL of the Docker registry for releases. Follows the same format as `extra_registries.name` and `registry.name` (e.g. `prefapp.azureacr.io`. See [Build Images -> Configuration](#configuration))
- `DOCKER_REGISTRY_SNAPSHOTS`: base URL of the Docker registry for snapshots. Follows the same format as `extra_registries.name` and `registry.name` (e.g. `prefapp.azureacr.io`. See [Build Images -> Configuration](#configuration))

#### About the `version` field

Specifies which image to dispatch. Can have any of the following values:

- `$latest_release`: the latest available release
- `$latest_prerelease`: the latest available prerelease
- `$branch_<branch_name>`: the latest available image associated to `<branch_name>`
- Any commit SHA (both short and long) or tag: the latest available image associated to the input

#### About the `Trigger deployment` workflow

A second workflow, `Trigger deployment` (with filename `trigger_deployment.yaml`), is also included. This is a simplified version of the more complex `make_dispatches` workflow, and is meant to be used by users who want to trigger simple deployments, to a specific `tenant`, `platform` and `env`. Its inputs are:

- `flavor`: which flavor to dispatch. Contrary to the normal `make_dispatches` workflow, only a single flavor can be specified here, and it will also dictate the `image_type` (i.e., if the flavor exists in `snapshots`, the image type will be `snapshots`, and the same for `releases`. If it exists in both, `*` will be used). Defaults to `default`
- `version`: equivalent to the `overwrite_version` input of the normal `make_dispatches` workflow, with one notable difference: if the value is left empty, `$latest_release` will be used
- `tenant`: equivalent to the `filter_by_tenant` input of the normal `make_dispatches` workflow. Mandatory
- `platform`: equivalent to the `filter_by_platform` input of the normal `make_dispatches` workflow. Mandatory
- `env`: equivalent to the `filter_by_env` input of the normal `make_dispatches` workflow. Mandatory

For ease of use, the `tenant`, `platform` and `env` inputs have been made into choice dropdowns, populated from the configuration files in the `.firestartr` repository. This population is done automatically via the `update-features-with-dot-firestartr-info.yaml` workflow from the [`claims_repo` feature](https://docs.firestartr.dev/docs/features/#-claims-repo). When this feature is installed for the first time, it's needed to either launch that workflow manually or wait until it automatically runs at midnight UTC, so that the dropdowns get populated with the correct values.

## Feature arguments

- `build_snapshots_branch`: which branch triggers an automatic snapshot build when pushed to. Defaults to the default branch of the repository, specified under `providers.github.branchStrategy.defaultBranch` inside the claim (usually `main` or `master`)
- `auth_strategy`: which authentication strategy to use when logging into the docker registries. Defaults to `azure_oidc`
- `build_snapshots_filter`: filter to apply when automatically building snapshot images. Defaults to an empty string (no filter)
- `build_pre_releases_filter`: filter to apply when automatically building pre-release images. Defaults to an empty string (no filter)
- `build_releases_filter`: filter to apply when automatically building release images. Defaults to an empty string (no filter)
- `default_snapshots_flavors_filter`: default filter shown in the UI when manually executing the build snapshots workflow. Defaults to `*`
- `default_pre_releases_flavors_filter`: default filter shown in the UI when manually executing the build pre-releases workflow. Defaults to `*`
- `default_releases_flavors_filter`: default filter shown in the UI when manually executing the build releases workflow. Defaults to `*`
- `firestartr_config_repo`: name of the repository that houses all the config files used by the `make_dispatches` workflow. Defaults to `${{ github.repository_owner }}/.firestartr`
- `make_dispatches_config_file_path`: path to the `make_dispatches` config file to be used by the `make_dispatches` workflow, relative to the root of the repository. Defaults to `.github/make_dispatches.yaml`
- `apps_folder_path`: path to the `apps` folder to be used by the `make_dispatches` workflow. This is a path local to the runner, used after all the configuration repositories have been downloaded. Defaults to `.firestartr/apps`
- `platform_folder_path`: path to the `platforms` folder to be used by the `make_dispatches` workflow. This is a path local to the runner, used after all the configuration repositories have been downloaded. Defaults to `.firestartr/platforms`
- `registries_folder_path`: path to the `docker_registries` folder to be used by the `make_dispatches` workflow. This is a path local to the runner, used after all the configuration repositories have been downloaded. Defaults to `.firestartr/docker_registries`

**NOTE**: `make_dispatches` downloads the `firestartr_config_repo` repository to access the configuration files via the `apps_folder_path`, `platform_folder_path` and `registries_folder_path` feature arguments. However, `firestartr_config_repo` is always downloaded under the `.firestartr` folder, regardless of what the actual name of the repository is, so the paths specified in the `*_folder_path` arguments should all start with `.firestartr/` (unless the folders are located in another repo)
