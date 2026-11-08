param([switch]$Setup, [switch]$SampleBooks, [int]$Port = 8000)
& (Join-Path $PSScriptRoot 'start-local.ps1') -Setup:$Setup -SampleBooks:$SampleBooks -Port $Port
